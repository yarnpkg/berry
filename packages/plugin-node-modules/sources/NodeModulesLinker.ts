import {InstallStatus, BuildDirective, MessageName}                    from '@yarnpkg/core';
import {Installer, Linker, LinkOptions, MinimalLinkOptions, LinkType}  from '@yarnpkg/core';
import {FetchResult, Descriptor, Locator, Package, BuildType}          from '@yarnpkg/core';
import {structUtils, Report, Manifest}                                 from '@yarnpkg/core';
import {NodeFS, VirtualFS, ZipOpenFS}                                  from '@yarnpkg/fslib';
import {PortablePath, npath, ppath, toFilename, Filename, xfs, FakeFS} from '@yarnpkg/fslib';
import {parseSyml}                                                     from '@yarnpkg/parsers';
import {NodeModulesLocatorMap, buildLocatorMap, buildNodeModulesTree}  from '@yarnpkg/pnpify';

import {PackageRegistry, makeRuntimeApi}                               from '@yarnpkg/pnp';
import {UsageError}                                                    from 'clipanion';
import fs                                                              from 'fs';
import mm                                                              from 'micromatch';

const NODE_MODULES = toFilename('node_modules');
const LOCATOR_STATE_FILE = toFilename('.yarn-state.yml');

type LocationMap = Map<PortablePath, Locator>;

export class NodeModulesLinker implements Linker {
  private cachedLocatorMap: NodeModulesLocatorMap | null = null;
  private cachedLocationMap: LocationMap | null = null;

  private async getLocatorMap(rootPath: PortablePath, options?: {reread?: boolean, ignoreStateFileReadErrors?: boolean}): Promise<{locatorMap: NodeModulesLocatorMap, locationMap: LocationMap}> {
    if (!this.cachedLocatorMap || (options && options.reread)) {
      try {
        this.cachedLocatorMap = await readLocatorState(ppath.join(rootPath, NODE_MODULES, LOCATOR_STATE_FILE), {unrollAliases: true});
      } catch (e) {
        if (options && options.ignoreStateFileReadErrors) {
          // Ignore errors if state file is absent
          this.cachedLocatorMap = new Map();
        } else {
          throw e;
        }
      }
      this.cachedLocationMap = new Map();
      for (const [locatorKey, val] of this.cachedLocatorMap) {
        const locator = structUtils.tryParseLocator(locatorKey)!;
        for (const location of val.locations) {
          this.cachedLocationMap.set(ppath.join(rootPath, location), locator);
        }
      }
    }

    return {locatorMap: this.cachedLocatorMap, locationMap: this.cachedLocationMap!};
  }

  supportsPackage(pkg: Package, opts: MinimalLinkOptions) {
    return opts.project.configuration.get('nodeLinker') === 'node-modules';
  }

  async findPackageLocation(locator: Locator, opts: LinkOptions) {
    const rootPath = opts.project.cwd;
    const {locatorMap} = await this.getLocatorMap(rootPath);
    const locatorInfo = locatorMap.get(structUtils.stringifyLocator(locator));

    if (!locatorInfo)
      throw new UsageError(`Couldn't find ${structUtils.prettyLocator(opts.project.configuration, locator)} in the currently installed node_modules map - running an install might help`);

    return ppath.join(rootPath, locatorInfo.locations[0]);
  }

  async findPackageLocator(location: PortablePath, opts: LinkOptions) {
    const rootPath = opts.project.cwd;
    const {locationMap} = await this.getLocatorMap(rootPath, {ignoreStateFileReadErrors: true});
    return locationMap.get(location) || null;
  }

  makeInstaller(opts: LinkOptions) {
    return new NodeModulesInstaller(opts, () => this.getLocatorMap(opts.project.cwd, {reread: true}));
  }
}

class NodeModulesInstaller implements Installer {
  private readonly packageRegistry: PackageRegistry = new Map();

  private readonly unpluggedPaths: Set<string> = new Set();
  private readonly blacklistedPaths: Set<string> = new Set();
  private readonly installedPackages: Map<LocatorKey, PortablePath> = new Map();
  private readonly onFinalizeInstall: () => Promise<any>;

  private readonly opts: LinkOptions;

  constructor(opts: LinkOptions, onFinalizeInstall: () => Promise<any>) {
    this.opts = opts;
    this.onFinalizeInstall = onFinalizeInstall;
  }

  async installPackage(pkg: Package, fetchResult: FetchResult) {
    const requirableIdent = structUtils.requirableIdent(pkg);
    const reference = pkg.reference;

    const packageFs = fetchResult.packageFs;

    const packageRawLocation = ppath.resolve(packageFs.getRealPath(), ppath.relative(PortablePath.root, fetchResult.prefixPath));

    const packageLocation = this.normalizeDirectoryPath(packageRawLocation);
    const packageDependencies = new Map<string, string | [string, string] | null>();
    const packagePeers = new Set<string>();

    for (const descriptor of pkg.peerDependencies.values()) {
      packageDependencies.set(structUtils.requirableIdent(descriptor), null);
      packagePeers.add(descriptor.name);
    }

    const packageStore = this.getPackageStore(requirableIdent);
    packageStore.set(reference, {packageLocation, packageDependencies, packagePeers, linkType: pkg.linkType});

    this.installedPackages.set(structUtils.stringifyLocator(pkg), packageLocation);

    return {
      packageLocation,
    };
  }

  async attachInternalDependencies(locator: Locator, dependencies: Array<[Descriptor, Locator]>) {
    const packageInformation = this.getPackageInformation(locator);

    for (const [descriptor, locator] of dependencies) {
      const target = !structUtils.areIdentsEqual(descriptor, locator)
        ? [structUtils.requirableIdent(locator), locator.reference] as [string, string]
        : locator.reference;

      packageInformation.packageDependencies.set(structUtils.requirableIdent(descriptor), target);
    }
  }

  async attachExternalDependents(locator: Locator, dependentPaths: Array<PortablePath>) {
    for (const dependentPath of dependentPaths) {
      const packageInformation = this.getDiskInformation(dependentPath);

      packageInformation.packageDependencies.set(structUtils.requirableIdent(locator), locator.reference);
    }
  }

  async finalizeInstall() {
    if (this.opts.project.configuration.get('nodeLinker') !== 'node-modules')
      return;

    this.trimBlacklistedPackages();

    this.packageRegistry.set(null, new Map([
      [null, this.getPackageInformation(this.opts.project.topLevelWorkspace.anchoredLocator)],
    ]));

    const buildIgnorePattern = (ignorePatterns: Array<string>) => {
      if (ignorePatterns.length === 0)
        return null;

      return ignorePatterns.map(pattern => {
        return `(${mm.makeRe(pattern).source})`;
      }).join(`|`);
    };

    const pnpFallbackMode = this.opts.project.configuration.get(`pnpFallbackMode`);

    const blacklistedLocations = this.blacklistedPaths;
    const dependencyTreeRoots = this.opts.project.workspaces.map(({anchoredLocator}) => ({name: structUtils.requirableIdent(anchoredLocator), reference: anchoredLocator.reference}));
    const enableTopLevelFallback = pnpFallbackMode !== `none`;
    const fallbackExclusionList = [];
    const ignorePattern = buildIgnorePattern([`.vscode/pnpify/**`, ...this.opts.project.configuration.get(`pnpIgnorePatterns`)]);
    const packageRegistry = this.packageRegistry;
    const shebang = this.opts.project.configuration.get(`pnpShebang`);
    const virtualRoots = [this.normalizeDirectoryPath(this.opts.project.configuration.get(`virtualFolder`))];

    if (pnpFallbackMode === `dependencies-only`)
      for (const pkg of this.opts.project.storedPackages.values())
        if (this.opts.project.tryWorkspaceByLocator(pkg))
          fallbackExclusionList.push({name: structUtils.requirableIdent(pkg), reference: pkg.reference});

    const pnpSettings = {
      blacklistedLocations,
      dependencyTreeRoots,
      enableTopLevelFallback,
      fallbackExclusionList,
      ignorePattern,
      packageRegistry,
      shebang,
      virtualRoots,
    };

    const pnpUnpluggedFolder = this.opts.project.configuration.get(`pnpUnpluggedFolder`);
    if (this.unpluggedPaths.size === 0) {
      await xfs.removePromise(pnpUnpluggedFolder);
    } else {
      for (const entry of await xfs.readdirPromise(pnpUnpluggedFolder)) {
        const unpluggedPath = ppath.resolve(pnpUnpluggedFolder, entry);
        if (!this.unpluggedPaths.has(unpluggedPath)) {
          await xfs.removePromise(unpluggedPath);
        }
      }
    }

    const nodeFs = new NodeFS(fs);
    const baseFs = new ZipOpenFS({
      baseFs: nodeFs,
      maxOpenFiles: 80,
      readOnlyArchives: true,
    });
    const defaultFsLayer: FakeFS<PortablePath> = new VirtualFS({baseFs});

    const rootPath = this.opts.project.cwd;
    let prevLocatorMap: NodeModulesLocatorMap;
    try {
      prevLocatorMap = await readLocatorState(ppath.join(rootPath, NODE_MODULES, LOCATOR_STATE_FILE));
    } catch (e) {
      // Remove build state as well, to force rebuild of all the packages
      const bstatePath = this.opts.project.configuration.get(`bstatePath`);
      if (await xfs.existsPromise(bstatePath))
        await xfs.unlinkPromise(bstatePath);
      prevLocatorMap = new Map();
    }

    const pnp = makeRuntimeApi(pnpSettings, rootPath, defaultFsLayer);
    const nmTree = buildNodeModulesTree(pnp, {pnpifyFs: false});
    const locatorMap = buildLocatorMap(rootPath, nmTree);
    await persistNodeModules(rootPath, prevLocatorMap, locatorMap, baseFs, this.opts.report);
    await this.onFinalizeInstall();

    const installStatuses: InstallStatus[] = [];

    for (const [locatorKey, val] of locatorMap.entries()) {
      const pkgLocation = val.locations[0];
      const manifest = await Manifest.find(pkgLocation);
      const buildScripts = await this.getBuildScripts(pkgLocation, manifest);
      const pkg = structUtils.parseLocator(locatorKey);

      if (buildScripts.length > 0 && !this.opts.project.configuration.get(`enableScripts`)) {
        this.opts.report.reportWarningOnce(MessageName.DISABLED_BUILD_SCRIPTS, `${structUtils.prettyLocator(this.opts.project.configuration, pkg)} lists build scripts, but all build scripts have been disabled.`);
        buildScripts.length = 0;
      }

      if (buildScripts.length > 0 && val.linkType !== LinkType.HARD && !this.opts.project.tryWorkspaceByLocator(pkg)) {
        this.opts.report.reportWarningOnce(MessageName.SOFT_LINK_BUILD, `${structUtils.prettyLocator(this.opts.project.configuration, pkg)} lists build scripts, but is referenced through a soft link. Soft links don't support build scripts, so they'll be ignored.`);
        buildScripts.length = 0;
      }

      const dependencyMeta = this.opts.project.getDependencyMeta(pkg, manifest.version);

      if (buildScripts.length > 0 && dependencyMeta && dependencyMeta.built === false) {
        this.opts.report.reportInfoOnce(MessageName.BUILD_DISABLED, `${structUtils.prettyLocator(this.opts.project.configuration, pkg)} lists build scripts, but its build has been explicitly disabled through configuration.`);
        buildScripts.length = 0;
      }

      const locator = structUtils.parseLocator(locatorKey);
      const packageLocation = this.installedPackages.get(locatorKey)!;
      installStatuses.push({
        buildLocations: val.locations.map(loc => ppath.join(rootPath, loc)),
        locatorHash: locator.locatorHash,
        packageLocation: packageLocation,
        buildDirective: buildScripts.length > 0 ? buildScripts : null,
      });
    }
    return installStatuses;
  }

  private async getBuildScripts(packageLocation: PortablePath, manifest: Manifest): Promise<BuildDirective[]> {
    const buildScripts: BuildDirective[] = [];
    const {scripts} = manifest;

    for (const scriptName of [`preinstall`, `install`, `postinstall`])
      if (scripts.has(scriptName))
        buildScripts.push([BuildType.SCRIPT, scriptName]);

    // Detect cases where a package has a binding.gyp but no install script
    const bindingFilePath = ppath.resolve(packageLocation, toFilename(`binding.gyp`));
    if (!scripts.has(`install`) && xfs.existsSync(bindingFilePath))
      buildScripts.push([BuildType.SHELLCODE, `node-gyp rebuild`]);

    return buildScripts;
  }

  private getPackageStore(key: string) {
    let packageStore = this.packageRegistry.get(key);

    if (!packageStore)
      this.packageRegistry.set(key, packageStore = new Map());

    return packageStore;
  }

  private getPackageInformation(locator: Locator) {
    const key1 = structUtils.requirableIdent(locator);
    const key2 = locator.reference;

    const packageInformationStore = this.packageRegistry.get(key1);
    if (!packageInformationStore)
      throw new Error(`Assertion failed: The package information store should have been available (for ${structUtils.prettyIdent(this.opts.project.configuration, locator)})`);

    const packageInformation = packageInformationStore.get(key2);
    if (!packageInformation)
      throw new Error(`Assertion failed: The package information should have been available (for ${structUtils.prettyLocator(this.opts.project.configuration, locator)})`);

    return packageInformation;
  }

  private getDiskInformation(path: PortablePath) {
    const packageStore = this.getPackageStore(`@@disk`);
    const normalizedPath = this.normalizeDirectoryPath(path);

    let diskInformation = packageStore.get(normalizedPath);

    if (!diskInformation) {
      packageStore.set(normalizedPath, diskInformation = {
        packageLocation: normalizedPath,
        packageDependencies: new Map(),
        packagePeers: new Set(),
        linkType: LinkType.SOFT,
      });
    }

    return diskInformation;
  }

  private trimBlacklistedPackages() {
    for (const packageStore of this.packageRegistry.values()) {
      for (const [key2, packageInformation] of packageStore) {
        if (this.blacklistedPaths.has(packageInformation.packageLocation)) {
          packageStore.delete(key2);
        }
      }
    }
  }

  private normalizeDirectoryPath(folder: PortablePath) {
    let relativeFolder = ppath.relative(this.opts.project.cwd, folder);

    if (!relativeFolder.match(/^\.{0,2}\//))
      // Don't use ppath.join here, it ignores the `.`
      relativeFolder = `./${relativeFolder}` as PortablePath;

    return relativeFolder.replace(/\/?$/, '/')  as PortablePath;
  }
}

const writeLocatorState = async (locatorStatePath: PortablePath, locatorMap: NodeModulesLocatorMap): Promise<void> => {
  let locatorState = '# Warning: This file is automatically generated. Removing it is fine, but will\n';
  locatorState += '# cause your node_modules installation to become invalidated.\n';
  locatorState += '\n__metadata:\n';
  locatorState += '  version: 1\n';
  for (const [locator, value] of locatorMap.entries()) {
    locatorState += `\n"${locator}":\n`;
    locatorState += `  locations:\n${Array.from(value.locations).map(loc => `    - "${loc}"\n`).join('')}`;
    if (value.aliases.length > 0) {
      locatorState += `  aliases:\n${Array.from(value.aliases).map(alias => `    - "${alias}"\n`).join('')}`;
    }
  }
  await xfs.writeFilePromise(locatorStatePath, locatorState);
};

const readLocatorState = async (locatorStatePath: PortablePath, options?: {unrollAliases: boolean}): Promise<NodeModulesLocatorMap> => {
  const locatorMap: NodeModulesLocatorMap = new Map();
  const locatorState = parseSyml(await xfs.readFilePromise(locatorStatePath, `utf8`));
  delete locatorState.__metadata;
  for (const [key, val] of Object.entries(locatorState)) {
    locatorMap.set(key, {
      target: PortablePath.dot,
      linkType: LinkType.HARD,
      locations: val.locations,
      aliases: val.aliases || [],
    });
    if (options && options.unrollAliases && val.aliases) {
      for (const alias of val.aliases) {
        const {scope, name} = structUtils.parseLocator(key);
        const aliasKey = structUtils.stringifyLocator(structUtils.makeLocator(structUtils.makeIdent(scope, name), alias));
        locatorMap.set(aliasKey, {
          target: PortablePath.dot,
          linkType: LinkType.HARD,
          locations: val.locations,
          aliases: [],
        });
      }
    }
  }

  return locatorMap;
};

const removeDir = async (dir: PortablePath, options?: {innerLoop?: boolean, excludeNodeModules?: boolean}): Promise<any> => {
  try {
    if (!options || !options.innerLoop) {
      const stats = await xfs.lstatPromise(dir);
      if (!stats.isDirectory()) {
        await xfs.unlinkPromise(dir);
        return;
      }
    }
    const entries = await xfs.readdirPromise(dir, {withFileTypes: true});
    for (const entry of entries) {
      const targetPath = ppath.join(dir, toFilename(entry.name));
      if (entry.isDirectory()) {
        if (entry.name !== NODE_MODULES || !options || !options.excludeNodeModules) {
          await removeDir(targetPath, {innerLoop: true});
        }
      } else {
        await xfs.unlinkPromise(targetPath);
      }
    }
    await xfs.rmdirPromise(dir);
  } catch (e) {
    if (e.code !== 'ENOENT' && e.code !== 'ENOTEMPTY') {
      throw e;
    }
  }
};

const ADD_CONCURRENT_LIMIT = 4;

type LocatorKey = string;
type LocationNode = { children: Map<Filename, LocationNode>, locator?: LocatorKey };
type LocationRoot = PortablePath;

/**
 * Locations tree. It starts with the map of location roots and continues as maps
 * of nested directory entries.
 *
 * Example:
 *  Map {
 *   '' => children: Map {
 *     'react-apollo' => {
 *       children: Map {
 *         'node_modules' => {
 *           children: Map {
 *             '@apollo' => {
 *               children: Map {
 *                 'react-hooks' => {
 *                   children: Map {},
 *                   locator: '@apollo/react-hooks:virtual:cf51d203f9119859b7628364a64433e4a73a44a577d2ffd0dfd5dd737a980bc6cddc70ed15c1faf959fc2ad6a8e103ce52fe188f2b175b5f4371d4381544d74e#npm:3.1.3'
 *                 }
 *               }
 *             }
 *           }
 *         }
 *       },
 *       locator: 'react-apollo:virtual:2499dbb93d824027565d71b0716c4fb8b548ad61955d0a0286bfb3c5b4058e227894b6691d96808c00f576db14870018375210362c26ee321ea99fd6ed041c74#npm:3.1.3'
 *     },
 *   },
 *   'packages/client' => children: Map {
 *     'node_modules' => Map {
 *       ...
 *     }
 *   }
 *   ...
 * }
 */
type LocationTree = Map<LocationRoot, LocationNode>

const parseLocation = (location: PortablePath): {locationRoot: PortablePath, segments: Filename[]} => {
  const allSegments = location.split(ppath.sep);
  const nmIndex = allSegments.indexOf(NODE_MODULES);
  const locationRoot: LocationRoot = npath.toPortablePath(allSegments.slice(0, nmIndex + 1).join(ppath.sep));
  const segments = allSegments.slice(nmIndex + 1).map(x => toFilename(x));
  return {locationRoot, segments};
};

const buildLocationTree = (locatorMap: NodeModulesLocatorMap): LocationTree => {
  const locationTree = new Map();

  for (const [locator, info] of locatorMap.entries()) {
    for (const location of info.locations) {
      const {locationRoot, segments} = parseLocation(location);
      let node = locationTree.get(locationRoot);
      if (!node) {
        node = {children: new Map()};
        locationTree.set(locationRoot, node);
      }
      for (let idx = 0; idx < segments.length; idx++) {
        const segment = segments[idx];
        const nextNode = node.children.get(segment);
        if (!nextNode) {
          const newNode: LocationNode = {children: new Map()};
          node.children.set(segment, newNode);
          node = newNode;
        } else {
          node = nextNode;
        }
        if (idx === segments.length - 1) {
          node.locator = locator;
        }
      }
    }
  }

  return locationTree;
};

const copyPromise = async (dstDir: PortablePath, srcDir: PortablePath, {baseFs}: {baseFs: FakeFS<PortablePath>}) => {
  await xfs.mkdirpPromise(dstDir);
  const entries = await baseFs.readdirPromise(srcDir, {withFileTypes: true});

  const copy = async (dstPath: PortablePath, srcPath: PortablePath, srcType: fs.Dirent) => {
    if (srcType.isFile()) {
      const stat = await baseFs.lstatPromise(srcPath);
      const content = await baseFs.readFilePromise(srcPath);
      await xfs.writeFilePromise(dstPath, content);
      const mode = stat.mode & 0o777;
      await xfs.chmodPromise(dstPath, mode);
    } else if (srcType.isSymbolicLink()) {
      const target = await baseFs.readlinkPromise(srcPath);
      await xfs.symlinkPromise(target, dstPath);
    } else {
      throw new Error(`Unsupported file type (file: ${srcPath}, mode: 0o${await xfs.statSync(srcPath).mode.toString(8).padStart(6, `0`)})`);
    }
  };

  for (const entry of entries) {
    const srcPath = ppath.join(srcDir, toFilename(entry.name));
    const dstPath = ppath.join(dstDir, toFilename(entry.name));
    if (entry.isDirectory()) {
      await copyPromise(dstPath, srcPath, {baseFs});
    } else {
      await copy(dstPath, srcPath, entry);
    }
  }
};

const persistNodeModules = async (rootPath: PortablePath, prevLocatorMap: NodeModulesLocatorMap, locatorMap: NodeModulesLocatorMap, baseFs: FakeFS<PortablePath>, report: Report) => {
  const rootNmDirPath = ppath.join(rootPath, NODE_MODULES);
  const locatorStatePath = ppath.join(rootNmDirPath, LOCATOR_STATE_FILE);

  const prevLocationTree = buildLocationTree(prevLocatorMap);
  const locationTree = buildLocationTree(locatorMap);

  const addQueue: Promise<any>[] = [];
  const addModule = async ({srcDir, dstDir, linkType, keepNodeModules}: {srcDir: PortablePath, dstDir: PortablePath, linkType: LinkType, keepNodeModules: boolean}) => {
    const promise: Promise<any> = (async () => {
      try {
        if (linkType === LinkType.SOFT && srcDir === dstDir)
          // Soft links to themselves are used to denote workspace packages, just ignore them
          return;
        await removeDir(dstDir, {excludeNodeModules: keepNodeModules});
        if (linkType === LinkType.SOFT) {
          await xfs.mkdirpPromise(ppath.dirname(dstDir));
          await xfs.symlinkPromise(ppath.relative(ppath.dirname(dstDir), srcDir), dstDir);
        } else {
          await copyPromise(dstDir, srcDir, {baseFs});
        }
      } catch (e) {
        e.message = `While persisting ${srcDir} -> ${dstDir} ${e.message}`;
        throw e;
      } finally {
        progress.tick();
      }
    })().then(() => addQueue.splice(addQueue.indexOf(promise), 1));
    addQueue.push(promise);
    if (addQueue.length > ADD_CONCURRENT_LIMIT) {
      await Promise.race(addQueue);
    }
  };

  const cloneModule = async (srcDir: PortablePath, dstDir: PortablePath, options?: { keepSrcNodeModules?: boolean, keepDstNodeModules?: boolean, innerLoop?: boolean }) => {
    try {
      if (!options || !options.innerLoop) {
        await removeDir(dstDir, {excludeNodeModules: options && options.keepDstNodeModules});
        await xfs.mkdirpPromise(dstDir);
      }

      const entries = await xfs.readdirPromise(srcDir, {withFileTypes: true});
      for (const entry of entries) {
        const entryName = toFilename(entry.name);
        const src = ppath.join(srcDir, entryName);
        const dst = ppath.join(dstDir, entryName);
        if (entryName !== NODE_MODULES || !options || !options.keepSrcNodeModules) {
          if (entry.isDirectory()) {
            await xfs.mkdirPromise(dst);
            await cloneModule(src, dst, {keepSrcNodeModules: false, keepDstNodeModules: false, innerLoop: true});
          } else {
            await xfs.copyFilePromise(src, dst, fs.constants.COPYFILE_FICLONE);
          }
        }
      }
    } catch (e) {
      if (!options || !options.innerLoop)
        e.message = `While cloning ${srcDir} -> ${dstDir} ${e.message}`;

      throw e;
    } finally {
      if (!options || !options.innerLoop) {
        progress.tick();
      }
    }
  };

  const deleteQueue: Promise<any>[] = [];
  const deleteModule = (dstDir: PortablePath) => {
    const promise = (async () => {
      try {
        await removeDir(dstDir);
      } catch (e) {
        e.message = `While removing ${dstDir} ${e.message}`;
        throw e;
      }
    })();
    deleteQueue.push(promise);
  };


  // Delete locations that no longer exist
  const deleteList: PortablePath[] = [];
  for (const {locations} of prevLocatorMap.values()) {
    for (const location of locations) {
      const {locationRoot, segments} = parseLocation(location);
      let node = locationTree.get(locationRoot);
      let curLocation = locationRoot;
      if (!node) {
        deleteList.push(ppath.join(rootPath, curLocation));
      } else {
        for (const segment of segments) {
          curLocation = ppath.join(curLocation, segment);
          node = node.children.get(segment);
          if (!node) {
            deleteList.push(ppath.join(rootPath, curLocation));
            break;
          }
        }
      }
    }
  }
  for (const dstDir of deleteList)
    deleteModule(dstDir);

  // Update changed locations
  const addList: Array<{srcDir: PortablePath, dstDir: PortablePath, linkType: LinkType, keepNodeModules: boolean}> = [];
  for (const [prevLocator, {locations}] of prevLocatorMap.entries()) {
    for (const location of locations) {
      const {locationRoot, segments} = parseLocation(location);
      let node = locationTree.get(locationRoot);
      let curLocation = locationRoot;
      if (node) {
        for (const segment of segments) {
          curLocation = ppath.join(curLocation, segment);
          node = node.children.get(segment);
          if (!node) {
            break;
          }
        }
        if (node && node.locator !== prevLocator) {
          const info = locatorMap.get(node.locator!)!;
          const srcDir = info.target;
          const dstDir = ppath.join(rootPath, curLocation);
          const linkType = info.linkType;
          const keepNodeModules = node.children.size > 0;
          addList.push({srcDir, dstDir, linkType, keepNodeModules});
        }
      }
    }
  }

  // Add new locations
  for (const [locator, {locations}] of locatorMap.entries()) {
    for (const location of locations) {
      const {locationRoot, segments} = parseLocation(location);
      let prevTreeNode = prevLocationTree.get(locationRoot);
      let node = locationTree.get(locationRoot);
      let curLocation = locationRoot;

      const info = locatorMap.get(locator)!;
      const srcDir = info.target;
      const dstDir = ppath.join(rootPath, location);
      const linkType = info.linkType;

      for (const segment of segments)
        node = node!.children.get(segment);

      if (!prevTreeNode) {
        addList.push({srcDir, dstDir, linkType, keepNodeModules: node!.children.size > 0});
      } else {
        for (const segment of segments) {
          curLocation = ppath.join(curLocation, segment);
          prevTreeNode = prevTreeNode.children.get(segment);
          if (!prevTreeNode) {
            addList.push({srcDir, dstDir, linkType, keepNodeModules: node!.children.size > 0});
            break;
          }
        }
      }
    }
  }

  const progress = Report.progressViaCounter(addList.length);
  report.reportProgress(progress);

  // First pass: persist all the modules only once in node_modules tree
  const persistedLocations = new Map<PortablePath, {dstDir: PortablePath, keepNodeModules: boolean}>();
  for (const entry of addList) {
    if (entry.linkType === LinkType.SOFT || !persistedLocations.has(entry.srcDir)) {
      persistedLocations.set(entry.srcDir, {dstDir: entry.dstDir, keepNodeModules: entry.keepNodeModules});
      await addModule({...entry});
    }
  }

  await Promise.all(deleteQueue);
  await Promise.all(addQueue);
  addQueue.length = 0;

  // Second pass: clone module duplicates
  for (const entry of addList) {
    const locationInfo = persistedLocations.get(entry.srcDir)!;
    if (entry.linkType !== LinkType.SOFT && entry.dstDir !== locationInfo.dstDir) {
      addQueue.push(cloneModule(locationInfo.dstDir, entry.dstDir, {keepSrcNodeModules: locationInfo.keepNodeModules, keepDstNodeModules: entry.keepNodeModules}));
    }
  }

  await Promise.all(addQueue);

  await xfs.mkdirpPromise(rootNmDirPath);
  await writeLocatorState(locatorStatePath, locatorMap);
};

