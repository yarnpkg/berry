import {BaseCommand, WorkspaceRequiredError}                                                                                                                         from '@yarnpkg/cli';
import {Configuration, Project, structUtils, Workspace, LocatorHash, Package, miscUtils, Locator, Cache, FormatType, FetchOptions, ThrowReport, Manifest, treeUtils} from '@yarnpkg/core';
import {xfs}                                                                                                                                                         from '@yarnpkg/fslib';
import {Command, Usage}                                                                                                                                              from 'clipanion';
import mm                                                                                                                                                            from 'micromatch';

import {Hooks}                                                                                                                                                       from '..';

// eslint-disable-next-line arca/no-default-export
export default class InfoCommand extends BaseCommand {
  @Command.Boolean(`-A,--all`)
  all: boolean = false;

  @Command.Array(`-X,--extra`)
  extra: Array<string> = [];

  @Command.Boolean(`--cache`)
  cache: boolean = false;

  @Command.Boolean(`--dependents`)
  dependents: boolean = false;

  @Command.Boolean(`--manifest`)
  manifest: boolean = false;

  @Command.Boolean(`--virtuals`)
  virtuals: boolean = false;

  @Command.Boolean(`--json`)
  json: boolean = false;

  @Command.Rest()
  patterns: Array<string> = [];

  static usage: Usage = Command.Usage({
    description: `see information related to packages`,
    details: `
      This command prints various information related to the specified packages, accepting glob patterns.

      By default, if the locator reference is missing, Yarn will default to print the information about all versions of the package in the active workspace dependency tree. To instead print all versions of the package in the whole project, use the \`-A,--all\` flag.

      Some fields will be hidden by default in order to keep the output readable, but can be selectively displayed by using additional options:\n

      - The \`--dependents\` flag will print all dependents for each matching package.
      - The \`--manifest\` flag will print data obtained by looking at the package archive (license, homepage, ...).
      - The \`--virtuals\` flag will print each instance of the virtual packages.

      Note that this command will only print the information directly related to the selected packages - if you wish to know why the package is there in the first place, use \`yarn why\` which will do just that (it also provides a \`-R,--recursive\` flag that may be of some help).
    `,
    examples: [[
      `Show information about Lodash`,
      `$0 info lodash`,
    ]],
  });

  @Command.Path(`info`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project, workspace} = await Project.find(configuration, this.context.cwd);
    const cache = await Cache.find(configuration);

    if (!workspace && !this.all)
      throw new WorkspaceRequiredError(project.cwd, this.context.cwd);

    await project.restoreInstallState();

    const extraSet = new Set(this.extra);
    if (this.cache)
      extraSet.add(`cache`);
    if (this.dependents)
      extraSet.add(`dependents`);
    if (this.manifest)
      extraSet.add(`manifest`);

    const traverse = (workspace: Workspace) => {
      const seen = new Map<LocatorHash, Package>();
      const pass = [workspace.anchoredLocator.locatorHash];

      while (pass.length > 0) {
        const hash = pass.shift()!;
        if (seen.has(hash))
          continue;

        const pkg = project.storedPackages.get(hash);
        if (typeof pkg === `undefined`)
          throw new Error(`Assertion failed: Expected the package to be registered`);

        seen.set(hash, pkg);

        for (const dependency of pkg.dependencies.values()) {
          const resolution = project.storedResolutions.get(dependency.descriptorHash);
          if (typeof resolution === `undefined`)
            throw new Error(`Assertion failed: Expected the resolution to be registered`);

          pass.push(resolution);
        }
      }

      return seen.values();
    };

    const lookupSet = this.all
      ? project.storedPackages.values()
      : traverse(workspace!);

    const matchers = this.patterns.map(pattern => {
      const parsed = structUtils.parseLocator(pattern);
      const regex = mm.makeRe(structUtils.stringifyIdent(parsed));

      return (pkg: Package) => {
        const stringifiedIdent = structUtils.stringifyIdent(pkg);
        if (!regex.test(stringifiedIdent))
          return false;

        if (parsed.reference !== `unknown`) {
          const checkReference = structUtils.isVirtualLocator(pkg)
            ? structUtils.devirtualizeLocator(pkg).reference
            : pkg.reference;

          if (parsed.reference !== checkReference) {
            return false;
          }
        }

        return true;
      };
    });

    const sortedLookup = miscUtils.sortMap([...lookupSet], pkg => {
      return structUtils.stringifyLocator(pkg);
    });

    const selected = sortedLookup.filter(pkg => {
      return matchers.length === 0 || matchers.some(matcher => matcher(pkg));
    });

    const dependentMap = new Map<LocatorHash, Array<Locator>>();

    if (this.dependents) {
      for (const pkg of sortedLookup) {
        for (const dependency of pkg.dependencies.values()) {
          const resolution = project.storedResolutions.get(dependency.descriptorHash);
          if (typeof resolution === `undefined`)
            throw new Error(`Assertion failed: Expected the resolution to be registered`);

          miscUtils.getArrayWithDefault(dependentMap, resolution).push(pkg);
        }
      }
    }

    const allInstances = new Map<LocatorHash, Array<Package>>();

    for (const pkg of selected) {
      if (!structUtils.isVirtualLocator(pkg))
        continue;

      const base = structUtils.devirtualizeLocator(pkg);
      miscUtils.getArrayWithDefault(allInstances, base.locatorHash).push(pkg);
    }

    const infoTreeChildren: treeUtils.TreeMap = {};
    const infoTree: treeUtils.TreeNode = {children: infoTreeChildren};

    const fetcher = configuration.makeFetcher();
    const fetcherOptions: FetchOptions = {project, fetcher, cache, checksums: project.storedChecksums, report: new ThrowReport(), skipIntegrityCheck: true};

    const builtinInfoBuilders: Array<Exclude<Hooks['fetchPackageInfo'], undefined>> = [
      // Manifest fields
      async (pkg, extra, registerData) => {
        if (!extra.has(`manifest`))
          return;

        const fetchResult = await fetcher.fetch(pkg, fetcherOptions);

        let manifest;
        try {
          manifest = await Manifest.find(fetchResult.prefixPath, {baseFs: fetchResult.packageFs});
        } finally {
          fetchResult.releaseFs?.();
        }

        registerData(`Manifest`, {
          [`License`]: [manifest.license, FormatType.NO_HINT],
          [`Homepage`]: [manifest.raw.homepage ?? null, FormatType.URL],
        });
      },

      // Cache info
      async (pkg, extra, registerData) => {
        if (!extra.has(`cache`))
          return;

        const checksum = project.storedChecksums.get(pkg.locatorHash) ?? null;
        const cachePath = cache.getLocatorPath(pkg, checksum);

        let stat;
        if (cachePath !== null) {
          try {
            stat = xfs.statSync(cachePath);
          } catch {}
        }

        const size = typeof stat !== `undefined`
          ? [stat.size, FormatType.SIZE] as const
          : undefined;

        registerData(`Cache`, {
          [`Checksum`]: [checksum, FormatType.NO_HINT],
          [`Path`]: [cachePath, FormatType.PATH],
          [`Size`]: size,
        });
      },
    ];

    for (const pkg of selected) {
      const isVirtual = structUtils.isVirtualLocator(pkg);
      if (!this.virtuals && isVirtual)
        continue;

      const nodeChildren: treeUtils.TreeMap = {};
      const node: treeUtils.TreeNode = {
        value: [pkg, FormatType.LOCATOR],
        children: nodeChildren,
      };

      infoTreeChildren[structUtils.stringifyLocator(pkg)] = node;

      const instances = allInstances.get(pkg.locatorHash);
      if (typeof instances !== `undefined`) {
        nodeChildren.instances = {
          label: `Instances`,
          value: [instances.length, FormatType.NUMBER],
        };
      }

      nodeChildren.version = {
        label: `Version`,
        value: [pkg.version, FormatType.NO_HINT],
      };

      const registerData = (namespace: string, info: ReadonlyArray<[any, FormatType]> | {[key: string]: readonly [any, FormatType] | undefined}) => {
        const namespaceNode: treeUtils.TreeNode = {};
        nodeChildren[namespace] = namespaceNode;

        if (Array.isArray(info)) {
          namespaceNode.children = info.map(value => ({value}));
        } else {
          const namespaceChildren: treeUtils.TreeMap = {};
          namespaceNode.children = namespaceChildren;

          for (const [key, value] of Object.entries(info)) {
            if (typeof value === `undefined`)
              continue;

            namespaceChildren[key] = {
              label: key,
              value,
            };
          }
        }
      };

      if (!isVirtual) {
        for (const infoBuilder of builtinInfoBuilders)
          await infoBuilder(pkg, extraSet, registerData);

        await configuration.triggerHook((hooks: Hooks) => {
          return hooks.fetchPackageInfo;
        }, pkg, extraSet, registerData);
      }

      if (pkg.bin.size > 0 && !isVirtual) {
        registerData(`Exported Binaries`, [...pkg.bin.keys()].map(name => {
          return [name, FormatType.PATH];
        }));
      }

      const dependents = dependentMap.get(pkg.locatorHash);
      if (typeof dependents !== `undefined` && dependents.length > 0) {
        registerData(`Dependents`, dependents.map(dependent => {
          return [dependent, FormatType.LOCATOR];
        }));
      }

      if (pkg.dependencies.size > 0 && !isVirtual) {
        registerData(`Dependencies`, [...pkg.dependencies.values()].map(dependency => {
          const resolutionHash = project.storedResolutions.get(dependency.descriptorHash);

          const resolution = typeof resolutionHash !== `undefined`
            ? project.storedPackages.get(resolutionHash) ?? null
            : null;

          return [{
            descriptor: dependency,
            locator: resolution,
          }, FormatType.RESOLUTION];
        }));
      }

      if (pkg.peerDependencies.size > 0 && isVirtual) {
        registerData(`Peer dependencies`, [...pkg.peerDependencies.values()].map(peerDependency => {
          const dependency = pkg.dependencies.get(peerDependency.identHash);

          const resolutionHash = typeof dependency !== `undefined`
            ? project.storedResolutions.get(dependency.descriptorHash) ?? null
            : null;

          const resolution = resolutionHash !== null
            ? project.storedPackages.get(resolutionHash) ?? null
            : null;

          return [{
            descriptor: peerDependency,
            locator: resolution,
          }, FormatType.RESOLUTION];
        }));
      }
    }

    treeUtils.emitTree(infoTree, {
      configuration,
      json: this.json,
      stdout: this.context.stdout,
      separators: 2,
    });
  }
}
