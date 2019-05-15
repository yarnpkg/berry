import {WorkspaceRequiredError}                                  from '@berry/cli';
import {Cache, Configuration, LightReport, LocatorHash, Package} from '@berry/core';
import {PluginConfiguration, Project, Workspace}                 from '@berry/core';
import {miscUtils, structUtils}                                  from '@berry/core';
import { PortablePath } from '@berry/fslib';
import {Writable}                                                from 'stream';
import {asTree}                                                  from 'treeify';

// eslint-disable-next-line arca/no-default-export
export default (clipanion: any, pluginConfiguration: PluginConfiguration) => clipanion

  .command(`why <package> [--peers]`)
  .describe(`display the reason why a package is needed`)

  .detail(`
    This command prints the exact reasons why a package appears in the dependency tree.

    If \`--peers\` is set, the command will also print the peer dependencies that match the specified name.
  `)

  .example(
    `Explain why lodash is used in your project`,
    `yarn why lodash`,
  )

  .action(async ({cwd, stdout, package: packageName, peers}: {cwd: PortablePath, stdout: Writable, package: string, peers: boolean}) => {
    const configuration = await Configuration.find(cwd, pluginConfiguration);
    const {project, workspace} = await Project.find(configuration, cwd);
    const cache = await Cache.find(configuration);

    if (!workspace)
      throw new WorkspaceRequiredError(cwd);

    const report = await LightReport.start({configuration, stdout}, async (report: LightReport) => {
      await project.resolveEverything({lockfileOnly: true, cache, report});
    });

    if (report.hasErrors())
      return report.exitCode();

    type TreeNode = {[key: string]: TreeNode};

    const empty = {} as TreeNode;
    const tree = {} as TreeNode;

    const printed = new Set();

    const makeBuilder = (previous: (() => TreeNode) | null, pkg: Package, range: string | null) => {
      return () => {
        const target = previous ? previous() : tree;
        if (target === empty)
          return empty;

        const label = range !== null
          ? `${structUtils.prettyLocator(configuration, pkg)} (via ${structUtils.prettyRange(configuration, range)})`
          : `${structUtils.prettyLocator(configuration, pkg)}`;

        if (!Object.prototype.hasOwnProperty.call(target, label)) {
          if ((previous && project.tryWorkspaceByLocator(pkg)) || printed.has(pkg.locatorHash)) {
            target[label] = empty;
          } else {
            target[label] = {} as TreeNode;
          }
        }

        printed.add(pkg.locatorHash);
        return target[label];
      };
    };

    const processWorkspace = (workspace: Workspace) => {
      const workspacePkg = project.storedPackages.get(workspace.anchoredLocator.locatorHash);
      if (!workspacePkg)
        throw new Error(`Assertion failed: The package should have been registered`);

      traversePackage(makeBuilder(null, workspacePkg, null), workspacePkg, new Set());
    };

    const traversePackage = (builder: () => TreeNode, pkg: Package, seen: Set<LocatorHash>) => {
      if (seen.has(pkg.locatorHash))
        return;

      if (structUtils.stringifyIdent(pkg) === packageName)
        builder();

      const nextSeen = new Set(seen);
      nextSeen.add(pkg.locatorHash);

      for (const dependency of pkg.dependencies.values()) {
        // We don't want to consider peer dependencies in "yarn why"
        if (!peers && pkg.peerDependencies.has(dependency.identHash))
          continue;

        const resolution = project.storedResolutions.get(dependency.descriptorHash);
        if (!resolution)
          throw new Error(`Assertion failed: The resolution should have been registered`);

        const nextPkg = project.storedPackages.get(resolution);
        if (!nextPkg)
          throw new Error(`Assertion failed: The package should have been registered`);

        traversePackage(makeBuilder(builder, nextPkg, dependency.range), nextPkg, nextSeen);
      }
    };

    const sortedWorkspaces = miscUtils.sortMap(project.workspaces, workspace => {
      return structUtils.stringifyLocator(workspace.anchoredLocator);
    });

    for (const workspace of sortedWorkspaces)
      processWorkspace(workspace);

    let treeOutput = asTree(tree, false, false);

    // A slight hack to add line returns between two workspaces
    treeOutput = treeOutput.replace(/^([├└]─)/gm, `│\n$1`).replace(/^│\n/, ``);

    stdout.write(treeOutput);
  });
