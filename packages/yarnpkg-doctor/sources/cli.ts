#!/usr/bin/env node

import {getPluginConfiguration}                                                                                                                                              from '@yarnpkg/cli';
import {Cache, Configuration, Project, Report, Workspace, structUtils, ProjectLookup, Manifest, Descriptor, HardDependencies, ThrowReport, StreamReport, MessageName, Ident} from '@yarnpkg/core';
import {PortablePath, npath, ppath, xfs}                                                                                                                                     from '@yarnpkg/fslib';
import {Cli, Command}                                                                                                                                                        from 'clipanion';
import globby                                                                                                                                                                from 'globby';
import micromatch                                                                                                                                                            from 'micromatch';
import {Module}                                                                                                                                                              from 'module';
import * as ts                                                                                                                                                               from 'typescript';

import * as ast                                                                                                                                                              from './ast';

const BUILTINS = new Set([...Module.builtinModules || [], `pnpapi`]);

function probablyMinified(content: string) {
  if (content.length > 1024 * 1024)
    return true;

  return false;
}

async function findFiles(pattern: string, cwd: PortablePath, {ignoredFolders = []}: {ignoredFolders?: Array<PortablePath>} = {}) {
  const files = await globby(pattern, {
    absolute: true,
    cwd: npath.fromPortablePath(cwd),
    ignore: [`**/node_modules/**`, ...ignoredFolders.map(p => `${npath.fromPortablePath(p)}/**`)],
  });

  return files.map(p => {
    return npath.toPortablePath(p);
  });
}

async function parseFile(p: PortablePath) {
  const content = await xfs.readFilePromise(p, `utf8`);
  if (probablyMinified(content))
    return null;

  return await ts.createSourceFile(
    npath.fromPortablePath(p),
    content,
    ts.ScriptTarget.ES2015,
    /*setParentNodes */ true,
  );
}

function extractIdents(name: string) {
  // We also support webpack loaders
  const parts = name.split(/!/);
  const idents = [];

  for (const part of parts) {
    // Webpack loaders can have query strings
    const partWithQs = part.replace(/\?.*/, ``);

    const match = partWithQs.match(/^(?!\.{0,2}(\/|$))(@[^/]*\/)?([^/]+)/);
    if (!match)
      continue;

    const ident = structUtils.tryParseIdent(match[0]);
    if (!ident)
      continue;

    idents.push(ident);
  }

  return idents;
}

function isValidDependency(ident: Ident, {workspace}: {workspace: Workspace}) {
  if (ident.identHash === workspace.locator.identHash)
    return true;

  if (workspace.manifest.hasDependency(ident))
    return true;

  return false;
}

function checkForUndeclaredDependency(workspace: Workspace, referenceNode: ts.Node, moduleName: string, {configuration, report}: {configuration: Configuration, report: Report}) {
  if (BUILTINS.has(moduleName))
    return;

  const idents = extractIdents(moduleName);

  for (const ident of idents) {
    if (isValidDependency(ident, {workspace}))
      continue;

    const prettyLocation = ast.prettyNodeLocation(configuration, referenceNode);
    report.reportError(MessageName.UNNAMED, `${prettyLocation}: Undeclared dependency on ${structUtils.prettyIdent(configuration, ident)}`);
  }
}

function checkForUnsafeWebpackLoaderAccess(workspace: Workspace, initializerNode: ts.Node, {configuration, report}: {configuration: Configuration, report: Report}) {
  if (workspace.manifest.private)
    return;
  if (initializerNode.kind === ts.SyntaxKind.CallExpression && ast.getCallType(initializerNode as ts.CallExpression) !== null)
    return;

  const prettyLocation = ast.prettyNodeLocation(configuration, initializerNode);
  report.reportWarning(MessageName.UNNAMED, `${prettyLocation}: Webpack configs from non-private packages should avoid referencing loaders without require.resolve`);
}

function checkForNodeModuleStrings(stringishNode: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral | ts.TemplateExpression , {configuration, report}: {configuration: Configuration, report: Report}) {
  const match = /node_modules(?!(\\{2}|\/)\.cache)/g.test(stringishNode.getText());
  if (match) {
    const prettyLocation = ast.prettyNodeLocation(configuration, stringishNode);
    report.reportWarning(MessageName.UNNAMED, `${prettyLocation}: Strings should avoid referencing the node_modules directory (prefer require.resolve)`);
  }
}

function processFile(workspace: Workspace, file: ts.SourceFile, {configuration, report}: {configuration: Configuration, report: Report}) {
  const importedModules = new Set<string>();

  const processNode = (node: ts.Node) => {
    switch (node.kind) {
      case ts.SyntaxKind.ImportDeclaration: {
        const decl = node as ts.ImportDeclaration;

        const importTarget = ast.extractStaticString(decl.moduleSpecifier)!;
        checkForUndeclaredDependency(workspace, decl, importTarget, {configuration, report});
      } break;

      case ts.SyntaxKind.ExportDeclaration: {
        const decl = node as ts.ExportDeclaration;
        if (!decl.moduleSpecifier)
          break;

        const importTarget = ast.extractStaticString(decl.moduleSpecifier)!;
        checkForUndeclaredDependency(workspace, decl, importTarget, {configuration, report});
      } break;

      case ts.SyntaxKind.CallExpression: {
        const call = node as ts.CallExpression;

        const callType = ast.getCallType(call);
        if (callType === null)
          break;

        const staticImport = ast.extractStaticString(call.arguments[0]);
        if (staticImport === null)
          break;

        checkForUndeclaredDependency(workspace, call, staticImport, {configuration, report});
      } break;

      case ts.SyntaxKind.PropertyAssignment: {
        const property = node as ts.PropertyAssignment;

        const name = ast.extractStaticName(property.name);
        if (name === null)
          break;

        if (name === `use` || name === `loader`) {
          checkForUnsafeWebpackLoaderAccess(workspace, property.initializer, {configuration, report});
        }
      } break;

      case ts.SyntaxKind.StringLiteral: {
        const stringNode = node as ts.StringLiteral;
        checkForNodeModuleStrings(stringNode, {configuration, report} );
      } break;

      case ts.SyntaxKind.NoSubstitutionTemplateLiteral: {
        const stringNode = node as ts.NoSubstitutionTemplateLiteral;

        checkForNodeModuleStrings(stringNode, {configuration, report} );
      } break;

      case ts.SyntaxKind.TemplateExpression: {
        const stringNode = node as ts.TemplateExpression;

        checkForNodeModuleStrings(stringNode, {configuration, report} );
      } break;
    }

    ts.forEachChild(node, processNode);
  };

  processNode(file);
  return importedModules;
}

async function buildJsonNode(p: PortablePath, accesses: Array<string>) {
  const content = await xfs.readFilePromise(p, `utf8`);

  // Just to be sure that it's valid JSON
  JSON.parse(content);

  const sourceFile = await ts.createSourceFile(
    npath.fromPortablePath(p),
    `(${content})`,
    ts.ScriptTarget.ES2015,
    /*setParentNodes */ true,
  );

  // @ts-ignore
  let node: ts.Node = sourceFile.statements[0].expression;
  if (!node)
    throw new Error(`Invalid source tree`);

  for (let t = 0; t < accesses.length; ++t) {
    if (node.kind !== ts.SyntaxKind.ObjectLiteralExpression)
      throw new Error(`Invalid property type: ${ts.SyntaxKind[node.kind]}`);

    const literal = node as ts.ObjectLiteralExpression;

    const property = literal.properties.find(property => {
      const name = property.name as ts.StringLiteral;
      return name.text === accesses[t];
    }) as ts.PropertyAssignment;

    if (!node)
      throw new Error(`Missing property "${accesses[t]}"`);

    node = property.initializer;
  }

  return node;
}

async function checkForUnmetPeerDependency(workspace: Workspace, dependencyType: HardDependencies, via: Descriptor, peer: Descriptor, {configuration, report}: {configuration: Configuration, report: Report}) {
  if (dependencyType === `dependencies` && workspace.manifest.hasConsumerDependency(peer))
    return;
  if (dependencyType === `devDependencies` && workspace.manifest.hasHardDependency(peer))
    return;

  const propertyNode = await buildJsonNode(ppath.join(workspace.cwd, Manifest.fileName), [dependencyType, structUtils.stringifyIdent(via)]);
  const prettyLocation = ast.prettyNodeLocation(configuration, propertyNode);

  report.reportError(MessageName.UNNAMED, `${prettyLocation}: Unmet transitive peer dependency on ${structUtils.prettyDescriptor(configuration, peer)}, via ${structUtils.prettyDescriptor(configuration, via)}`);
}

async function makeResolveFn(project: Project) {
  const cache = await Cache.find(project.configuration);

  const resolver = project.configuration.makeResolver();
  const fetcher = project.configuration.makeFetcher();

  const checksums = project.storedChecksums;
  const yarnReport = new ThrowReport();

  const fetchOptions = {project, fetcher, cache, checksums, report: yarnReport};
  const resolveOptions = {...fetchOptions, resolver};

  return async (descriptor: Descriptor) => {
    const candidates = await resolver.getCandidates(descriptor, new Map(), resolveOptions);
    if (candidates.length === 0)
      return null;

    return await resolver.resolve(candidates[0], resolveOptions);
  };
}

async function processManifest(workspace: Workspace, {configuration, report}: {configuration: Configuration, report: Report}) {
  const resolveFn = await makeResolveFn(workspace.project);

  for (const dependencyType of Manifest.hardDependencies) {
    for (const viaDescriptor of workspace.manifest[dependencyType].values()) {
      let pkg;

      try {
        pkg = await resolveFn(viaDescriptor);
      } catch (error) {
        report.reportWarning(MessageName.UNNAMED, `Resolving ${structUtils.prettyDescriptor(configuration, viaDescriptor)} errored with ${error.message}`);
        continue;
      }

      if (!pkg) {
        report.reportWarning(MessageName.UNNAMED, `Couldn't find a valid resolution for ${structUtils.prettyDescriptor(configuration, viaDescriptor)}`);
        continue;
      }

      for (const peerDescriptor of pkg.peerDependencies.values()) {
        // No need to check optional peer dependencies at all
        const peerDependencyMeta = pkg.peerDependenciesMeta.get(structUtils.stringifyIdent(peerDescriptor));
        if (typeof peerDependencyMeta !== `undefined` && peerDependencyMeta.optional)
          continue;

        await checkForUnmetPeerDependency(workspace, dependencyType, viaDescriptor, peerDescriptor, {configuration, report});
      }
    }
  }
}

async function processWorkspace(workspace: Workspace, {configuration, fileList, report}: {configuration: Configuration, fileList: Array<PortablePath>, report: Report}) {
  const progress = StreamReport.progressViaCounter(fileList.length + 1);
  const reportedProgress = report.reportProgress(progress);

  for (const scriptName of workspace.manifest.scripts.keys())
    if (scriptName.match(/^(pre|post)(?!(install|pack)$)/))
      report.reportWarning(MessageName.UNNAMED, `User scripts prefixed with "pre" or "post" (like "${scriptName}") will not be called in sequence anymore; prefer calling prologues and epilogues explicitly`);

  for (const p of fileList) {
    const parsed = await parseFile(p);

    if (parsed !== null)
      processFile(workspace, parsed, {configuration, report});

    progress.tick();
  }

  await processManifest(workspace, {configuration, report});
  progress.tick();

  await reportedProgress;
}

class EntryCommand extends Command {
  @Command.Boolean(`--scoped`)
  scoped: boolean = false;

  @Command.String({required: false})
  cwd: string = `.`;

  async execute() {
    const cwd = npath.toPortablePath(npath.resolve(this.cwd));

    const configuration = await Configuration.find(cwd, null, {strict: false});

    const allManifests = await findFiles(`**/package.json`, cwd);
    const allManifestFolders = allManifests.map(p => ppath.dirname(p));

    const allFiles = await findFiles(`**/*.{ts,tsx,js,jsx}`, cwd);

    const pluginConfiguration = getPluginConfiguration();

    const findStandaloneWorkspace = async (manifestCwd: PortablePath) => {
      const configuration = await Configuration.find(manifestCwd, pluginConfiguration, {strict: false, lookup: ProjectLookup.NONE});
      const {workspace} = await Project.find(configuration, manifestCwd);

      return workspace;
    };

    const findLockfileWorkspace = async (manifestCwd: PortablePath) => {
      const configuration = await Configuration.find(manifestCwd, pluginConfiguration, {strict: false});
      if (!configuration.projectCwd)
        return null;

      const {project} = await Project.find(configuration, configuration.projectCwd);
      const workspace = project.tryWorkspaceByCwd(manifestCwd);
      if (!workspace)
        return null;

      return workspace;
    };

    const findWorkspace = async (manifestCwd: PortablePath) => {
      const lockfileWorkspace = await findLockfileWorkspace(manifestCwd);
      if (lockfileWorkspace)
        return lockfileWorkspace;

      const standaloneWorkspace = await findStandaloneWorkspace(manifestCwd);
      if (standaloneWorkspace)
        return standaloneWorkspace;

      return null;
    };

    await StreamReport.start({
      configuration,
      stdout: this.context.stdout,
    }, async report => {
      report.reportInfo(MessageName.UNNAMED, `Found ${allManifestFolders.length} package(s) to process`);
      report.reportInfo(MessageName.UNNAMED, `For a grand total of ${allFiles.length} file(s) to validate`);

      const progress = StreamReport.progressViaCounter(allManifestFolders.length);
      const reportedProgress = report.reportProgress(progress);

      try {
        for (const manifestFolder of allManifestFolders) {
          const manifestPath = ppath.join(manifestFolder, Manifest.fileName);

          report.reportSeparator();

          try {
            await report.startTimerPromise(manifestPath, async () => {
              const workspace = await findWorkspace(manifestFolder);
              if (!workspace)
                return;

              const patterns = [`${manifestFolder}/**`];
              const ignore = [];

              for (const otherManifestFolder of allManifestFolders) {
                const sub = ppath.contains(manifestFolder, otherManifestFolder);
                if (sub !== null && sub !== `.`) {
                  ignore.push(`${otherManifestFolder}/**`);
                }
              }

              const fileList = micromatch(allFiles, patterns, {ignore}) as Array<PortablePath>;

              await processWorkspace(workspace, {
                configuration,
                fileList,
                report,
              });
            });
          } catch {}

          progress.tick();
        }
      } catch (error) {
        reportedProgress.stop();
        throw error;
      }

      report.reportSeparator();
      await reportedProgress;
    });
  }
}

const cli = new Cli({binaryName: `yarn dlx @yarnpkg/doctor`});
cli.register(EntryCommand);
cli.runExit(process.argv.slice(2), {
  stdin: process.stdin,
  stdout: process.stdout,
  stderr: process.stderr,
});
