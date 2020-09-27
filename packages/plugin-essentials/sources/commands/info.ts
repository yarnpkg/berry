import {BaseCommand, WorkspaceRequiredError}                                                                                                                          from '@yarnpkg/cli';
import {Configuration, Project, structUtils, Workspace, LocatorHash, Package, formatUtils, miscUtils, Locator, Cache, FetchOptions, ThrowReport, Manifest, treeUtils} from '@yarnpkg/core';
import {xfs}                                                                                                                                                          from '@yarnpkg/fslib';
import {Command, Usage, UsageError}                                                                                                                                   from 'clipanion';
import mm                                                                                                                                                             from 'micromatch';

import {Hooks}                                                                                                                                                        from '..';

// eslint-disable-next-line arca/no-default-export
export default class InfoCommand extends BaseCommand {
  @Command.Boolean(`-A,--all`, {description: `Print versions of a package from the whole project`})
  all: boolean = false;

  @Command.Array(`-X,--extra`, {description: `An array of requests of extra data provided by plugins`})
  extra: Array<string> = [];

  @Command.Boolean(`--cache`, {description: `Print information about the cache entry of a package (path, size, checksum)`})
  cache: boolean = false;

  @Command.Boolean(`--dependents`, {description: `Print all dependents for each matching package`})
  dependents: boolean = false;

  @Command.Boolean(`--manifest`, {description: `Print data obtained by looking at the package archive (license, homepage, ...)`})
  manifest: boolean = false;

  @Command.Boolean(`--virtuals`, {description: `Print each instance of the virtual packages`})
  virtuals: boolean = false;

  @Command.Boolean(`--json`, {description: `Format the output as an NDJSON stream`})
  json: boolean = false;

  @Command.Rest()
  patterns: Array<string> = [];

  static usage: Usage = Command.Usage({
    description: `see information related to packages`,
    details: `
      This command prints various information related to the specified packages, accepting glob patterns.

      By default, if the locator reference is missing, Yarn will default to print the information about all versions of the package in the active workspace dependency tree. To instead print all versions of the package in the whole project, use the \`-A,--all\` flag.

      Some fields will be hidden by default in order to keep the output readable, but can be selectively displayed by using additional options (\`--dependents\`, \`--manifest\`, \`--virtuals\`, ...) described in the option descriptions.

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

        if (structUtils.isVirtualLocator(pkg))
          pass.push(structUtils.devirtualizeLocator(pkg).locatorHash);

        for (const dependency of pkg.dependencies.values()) {
          const resolution = project.storedResolutions.get(dependency.descriptorHash);
          if (typeof resolution === `undefined`)
            throw new Error(`Assertion failed: Expected the resolution to be registered`);

          pass.push(resolution);
        }
      }

      return seen.values();
    };

    const findSelectedSet = ({all}: {all: boolean}) => {
      const lookupSet = all
        ? project.storedPackages.values()
        : traverse(workspace!);

      const matchers = this.patterns.map(pattern => {
        const patternLocator = structUtils.parseLocator(pattern);
        const identRegex = mm.makeRe(structUtils.stringifyIdent(patternLocator));

        const patternIsVirtual = structUtils.isVirtualLocator(patternLocator);
        const uvPatternLocator = patternIsVirtual
          ? structUtils.devirtualizeLocator(patternLocator)
          : patternLocator;

        return (pkg: Package) => {
          const stringifiedIdent = structUtils.stringifyIdent(pkg);
          if (!identRegex.test(stringifiedIdent))
            return false;

          if (patternLocator.reference === `unknown`)
            return true;

          const pkgIsVirtual = structUtils.isVirtualLocator(pkg);
          const uvPkgLocator = pkgIsVirtual
            ? structUtils.devirtualizeLocator(pkg)
            : pkg;

          // If the pattern is explicitly virtual, we only accept this one virtual package, never the others
          if (patternIsVirtual && pkgIsVirtual && patternLocator.reference !== pkg.reference)
            return false;

          // We only accept that belong to the current reference (or its base if it's a virtual package)
          if (uvPatternLocator.reference !== uvPkgLocator.reference)
            return false;

          return true;
        };
      });

      const sortedLookup = miscUtils.sortMap([...lookupSet], pkg => {
        return structUtils.stringifyLocator(pkg);
      });

      const selection = sortedLookup.filter(pkg => {
        return matchers.length === 0 || matchers.some(matcher => matcher(pkg));
      });

      return {selection, sortedLookup};
    };

    const {selection, sortedLookup} = findSelectedSet({
      all: this.all,
    });

    if (selection.length === 0) {
      if (this.all || findSelectedSet({all: true}).selection.length === 0) {
        throw new UsageError(`No package matched your request`);
      } else {
        throw new UsageError(`No package matched your request in this workspace, but some matches were found elsewhere - run the command again with -A,--all to see them all`);
      }
    }

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

    for (const pkg of sortedLookup) {
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
          [`License`]: formatUtils.tuple(formatUtils.Type.NO_HINT, manifest.license),
          [`Homepage`]: formatUtils.tuple(formatUtils.Type.URL, manifest.raw.homepage ?? null),
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
          ? [stat.size, formatUtils.Type.SIZE] as const
          : undefined;

        registerData(`Cache`, {
          [`Checksum`]: formatUtils.tuple(formatUtils.Type.NO_HINT, checksum),
          [`Path`]: formatUtils.tuple(formatUtils.Type.PATH, cachePath),
          [`Size`]: size,
        });
      },
    ];

    for (const pkg of selection) {
      const isVirtual = structUtils.isVirtualLocator(pkg);
      if (!this.virtuals && isVirtual)
        continue;

      const nodeChildren: treeUtils.TreeMap = {};
      const node: treeUtils.TreeNode = {
        value: [pkg, formatUtils.Type.LOCATOR],
        children: nodeChildren,
      };

      infoTreeChildren[structUtils.stringifyLocator(pkg)] = node;

      const instances = allInstances.get(pkg.locatorHash);
      if (typeof instances !== `undefined`) {
        nodeChildren.Instances = {
          label: `Instances`,
          value: formatUtils.tuple(formatUtils.Type.NUMBER, instances.length),
        };
      }

      nodeChildren.Version = {
        label: `Version`,
        value: formatUtils.tuple(formatUtils.Type.NO_HINT, pkg.version),
      };

      const registerData = (namespace: string, info: Array<formatUtils.Tuple> | {[key: string]: formatUtils.Tuple | undefined}) => {
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
          return formatUtils.tuple(formatUtils.Type.PATH, name);
        }));
      }

      const dependents = dependentMap.get(pkg.locatorHash);
      if (typeof dependents !== `undefined` && dependents.length > 0) {
        registerData(`Dependents`, dependents.map(dependent => {
          return formatUtils.tuple(formatUtils.Type.LOCATOR, dependent);
        }));
      }

      if (pkg.dependencies.size > 0 && !isVirtual) {
        registerData(`Dependencies`, [...pkg.dependencies.values()].map(dependency => {
          const resolutionHash = project.storedResolutions.get(dependency.descriptorHash);

          const resolution = typeof resolutionHash !== `undefined`
            ? project.storedPackages.get(resolutionHash) ?? null
            : null;

          return formatUtils.tuple(formatUtils.Type.RESOLUTION, {
            descriptor: dependency,
            locator: resolution,
          });
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

          return formatUtils.tuple(formatUtils.Type.RESOLUTION, {
            descriptor: peerDependency,
            locator: resolution,
          });
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
