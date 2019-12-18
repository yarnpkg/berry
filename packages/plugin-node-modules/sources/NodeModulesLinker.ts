import {miscUtils, structUtils, Ident, DependencyMeta, Report}                  from '@yarnpkg/core';
import {FetchResult, Descriptor, Locator, Package, BuildType}                   from '@yarnpkg/core';
import {Installer, Linker, LinkOptions, MinimalLinkOptions, Manifest, LinkType} from '@yarnpkg/core';
import {PortablePath, npath, ppath, toFilename, Filename, xfs, FakeFS, CwdFS}   from '@yarnpkg/fslib';
import {NodeFS, VirtualFS, ZipOpenFS}                                           from '@yarnpkg/fslib';
import {parseSyml}                                                              from '@yarnpkg/parsers';
import {NodeModulesLocatorMap, buildLocatorMap, buildNodeModulesTree}           from '@yarnpkg/pnpify';
import {PackageRegistry, makeRuntimeApi}                                        from '@yarnpkg/pnp';

import {UsageError}                                                             from 'clipanion';
import fs                                                                       from 'fs';

import {getPnpPath}                                                             from './index';

const FORCED_UNPLUG_PACKAGES = new Set([
  // Some packages do weird stuff and MUST be unplugged. I don't like them.
  structUtils.makeIdent(null, `nan`).identHash,
  structUtils.makeIdent(null, `node-gyp`).identHash,
  structUtils.makeIdent(null, `node-pre-gyp`).identHash,
  structUtils.makeIdent(null, `node-addon-api`).identHash,
  // Those ones contain native builds (*.node), and Node loads them through dlopen
  structUtils.makeIdent(null, `fsevents`).identHash,
]);

const NODE_MODULES = toFilename('node_modules');
const LOCATOR_STATE_FILE = toFilename('.yarn-state.yml');

export class NodeModulesLinker implements Linker {
  supportsPackage(pkg: Package, opts: MinimalLinkOptions) {
    return opts.project.configuration.get('nodeLinker') === 'node-modules';
  }

  async findPackageLocation(locator: Locator, opts: LinkOptions) {
    const pnpPath = getPnpPath(opts.project);
    if (!xfs.existsSync(pnpPath))
      throw new UsageError(`The project in ${opts.project.cwd}/package.json doesn't seem to have been installed - running an install there might help`);

    const physicalPath = npath.fromPortablePath(pnpPath);
    const pnpFile = miscUtils.dynamicRequire(physicalPath);
    delete require.cache[physicalPath];

    const packageLocator = {name: structUtils.requirableIdent(locator), reference: locator.reference};
    const packageInformation = pnpFile.getPackageInformation(packageLocator);

    if (!packageInformation)
      throw new UsageError(`Couldn't find ${structUtils.prettyLocator(opts.project.configuration, locator)} in the currently installed PnP map - running an install might help`);

    return npath.toPortablePath(packageInformation.packageLocation);
  }

  async findPackageLocator(location: PortablePath, opts: LinkOptions) {
    const pnpPath = getPnpPath(opts.project);
    if (!xfs.existsSync(pnpPath))
      throw new UsageError(`The project in ${opts.project.cwd}/package.json doesn't seem to have been installed - running an install there might help`);

    const physicalPath = npath.fromPortablePath(pnpPath);
    const pnpFile = miscUtils.dynamicRequire(physicalPath);
    delete require.cache[physicalPath];

    const locator = pnpFile.findPackageLocator(npath.fromPortablePath(location));
    if (!locator)
      return null;

    return structUtils.makeLocator(structUtils.parseIdent(locator.name), locator.reference);
  }

  makeInstaller(opts: LinkOptions) {
    return new NodeModulesInstaller(opts);
  }
}

class NodeModulesInstaller implements Installer {
  private readonly packageRegistry: PackageRegistry = new Map();

  private readonly unpluggedPaths: Set<string> = new Set();
  private readonly blacklistedPaths: Set<string> = new Set();

  private readonly opts: LinkOptions;

  constructor(opts: LinkOptions) {
    this.opts = opts;
  }

  async installPackage(pkg: Package, fetchResult: FetchResult) {
    const key1 = structUtils.requirableIdent(pkg);
    const key2 = pkg.reference;

    // const buildScripts = await this.getBuildScripts(fetchResult);

    // if (buildScripts.length > 0 && !this.opts.project.configuration.get(`enableScripts`)) {
    //   this.opts.report.reportWarningOnce(MessageName.DISABLED_BUILD_SCRIPTS, `${structUtils.prettyLocator(this.opts.project.configuration, pkg)} lists build scripts, but all build scripts have been disabled.`);
    //   buildScripts.length = 0;
    // }

    // if (buildScripts.length > 0 && pkg.linkType !== LinkType.HARD && !this.opts.project.tryWorkspaceByLocator(pkg)) {
    //   this.opts.report.reportWarningOnce(MessageName.SOFT_LINK_BUILD, `${structUtils.prettyLocator(this.opts.project.configuration, pkg)} lists build scripts, but is referenced through a soft link. Soft links don't support build scripts, so they'll be ignored.`);
    //   buildScripts.length = 0;
    // }

    // const dependencyMeta = this.opts.project.getDependencyMeta(pkg, pkg.version);

    // if (buildScripts.length > 0 && dependencyMeta && dependencyMeta.built === false) {
    //   this.opts.report.reportInfoOnce(MessageName.BUILD_DISABLED, `${structUtils.prettyLocator(this.opts.project.configuration, pkg)} lists build scripts, but its build has been explicitly disabled through configuration.`);
    //   buildScripts.length = 0;
    // }

    // const hasVirtualInstances =
    //   pkg.peerDependencies.size > 0 &&
    //   !structUtils.isVirtualLocator(pkg) &&
    //   !this.opts.project.tryWorkspaceByLocator(pkg);

    // const packageFs = !hasVirtualInstances && pkg.linkType !== LinkType.SOFT && (buildScripts.length > 0 || this.isUnplugged(pkg, dependencyMeta))
    //   ? await this.unplugPackage(pkg, fetchResult.packageFs)
    //   : fetchResult.packageFs;
    const packageFs = fetchResult.packageFs;

    const packageRawLocation = ppath.resolve(packageFs.getRealPath(), ppath.relative(PortablePath.root, fetchResult.prefixPath));

    const packageLocation = this.normalizeDirectoryPath(packageRawLocation);
    const packageDependencies = new Map<string, string | [string, string] | null>();
    const packagePeers = new Set<string>();

    for (const descriptor of pkg.peerDependencies.values()) {
      packageDependencies.set(structUtils.requirableIdent(descriptor), null);
      packagePeers.add(descriptor.name);
    }

    const packageStore = this.getPackageStore(key1);
    packageStore.set(key2, {packageLocation, packageDependencies, packagePeers, linkType: pkg.linkType});

    // if (hasVirtualInstances)
    //   this.blacklistedPaths.add(packageLocation);

    // return {
    //   packageLocation,
    //   buildDirective: buildScripts.length > 0 ? buildScripts as BuildDirective[] : null,
    // };
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
    const startTime = Date.now();
    if (this.opts.project.configuration.get('nodeLinker') !== 'node-modules')
      return;

    this.trimBlacklistedPackages();

    this.packageRegistry.set(null, new Map([
      [null, this.getPackageInformation(this.opts.project.topLevelWorkspace.anchoredLocator)],
    ]));

    const pnpFallbackMode = this.opts.project.configuration.get(`pnpFallbackMode`);

    const blacklistedLocations = this.blacklistedPaths;
    const dependencyTreeRoots = this.opts.project.workspaces.map(({anchoredLocator}) => ({name: structUtils.requirableIdent(anchoredLocator), reference: anchoredLocator.reference}));
    const enableTopLevelFallback = pnpFallbackMode !== `none`;
    const fallbackExclusionList = [];
    const ignorePattern = this.opts.project.configuration.get(`pnpIgnorePattern`);
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
      prevLocatorMap = new Map();
    }

    const pnp = makeRuntimeApi(pnpSettings, rootPath, defaultFsLayer);
    const nmTree = buildNodeModulesTree(pnp, {
      optimizeSizeOnDisk: true,
      knownLocatorWeights: new Map(Array.from(prevLocatorMap).map(([key, val]) => [key, val.size])),
      pnpifyFs: false,
    });
    const locatorMap = buildLocatorMap(rootPath, nmTree);
    await persistNodeModules(rootPath, prevLocatorMap, locatorMap, baseFs, this.opts.report);
    const endTime = Date.now();
    console.log(`Persist time: ${endTime - startTime}ms`);
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

  private async getBuildScripts(fetchResult: FetchResult) {
    if (!await fetchResult.packageFs.existsPromise(ppath.resolve(fetchResult.prefixPath, toFilename(`package.json`))))
      return [];

    const buildScripts = [];
    const {scripts} = await Manifest.find(fetchResult.prefixPath, {baseFs: fetchResult.packageFs});

    for (const scriptName of [`preinstall`, `install`, `postinstall`])
      if (scripts.has(scriptName))
        buildScripts.push([BuildType.SCRIPT, scriptName]);

    // Detect cases where a package has a binding.gyp but no install script
    const bindingFilePath = ppath.resolve(fetchResult.prefixPath, toFilename(`binding.gyp`));
    if (!scripts.has(`install`) && fetchResult.packageFs.existsSync(bindingFilePath))
      buildScripts.push([BuildType.SHELLCODE, `node-gyp rebuild`]);

    return buildScripts;
  }

  private getUnpluggedPath(locator: Locator) {
    return ppath.resolve(this.opts.project.configuration.get(`pnpUnpluggedFolder`), structUtils.slugifyLocator(locator));
  }

  private async unplugPackage(locator: Locator, packageFs: FakeFS<PortablePath>) {
    const unplugPath = this.getUnpluggedPath(locator);
    this.unpluggedPaths.add(unplugPath);

    await xfs.mkdirpPromise(unplugPath);
    await xfs.copyPromise(unplugPath, PortablePath.dot, {baseFs: packageFs, overwrite: false});

    return new CwdFS(unplugPath);
  }

  private isUnplugged(ident: Ident, dependencyMeta: DependencyMeta) {
    if (dependencyMeta.unplugged)
      return true;

    if (FORCED_UNPLUG_PACKAGES.has(ident.identHash))
      return true;

    return false;
  }
}

const writeLocatorState = async (locatorStatePath: PortablePath, locatorMap: NodeModulesLocatorMap): Promise<void> => {
  let locatorState = '# Warning: This file is automatically generated. Removing it is fine, but will\n';
  locatorState += '# cause your node_modules installation to become invalidated.\n';
  locatorState += '\n__metadata:\n';
  locatorState += '  version: 1\n';
  for (const [locator, value] of locatorMap.entries()) {
    locatorState += `\n"${locator}":\n`;
    locatorState += `  size: ${value.size}\n`;
    locatorState += `  locations:\n${Array.from(value.locations).map(loc => `    - "${loc}"\n`).join('')}`;
  }
  await xfs.writeFilePromise(locatorStatePath, locatorState);
};

const readLocatorState = async (locatorStatePath: PortablePath): Promise<NodeModulesLocatorMap> => {
  const locatorMap: NodeModulesLocatorMap = new Map();
  const locatorState = parseSyml(await xfs.readFilePromise(locatorStatePath, `utf8`));
  delete locatorState.__metadata;
  for (const [key, val] of Object.entries(locatorState)) {
    locatorMap.set(key, {
      size: +val.size,
      target: PortablePath.dot,
      linkType: LinkType.HARD,
      locations: new Set(val.locations),
    });
  }

  return locatorMap;
};

const removeDir = async (dir: PortablePath, options?: {innerLoop?: boolean, excludeNodeModules?: boolean}): Promise<any> => {
  try {
    if (options && !options.innerLoop) {
      const stats = xfs.lstatSync(dir);
      if (!stats.isDirectory()) {
        xfs.unlinkSync(dir);
        return;
      }
    }
    const queue: Array<Promise<any>> = [];
    const entries = xfs.readdirSync(dir, {withFileTypes: true});
    for (const entry of entries) {
      const targetPath = ppath.join(dir, toFilename(entry.name));
      if (entry.isDirectory()) {
        if (entry.name !== NODE_MODULES || !options || !options.excludeNodeModules) {
          queue.push(removeDir(targetPath, {innerLoop: true}));
        }
      } else {
        queue.push(xfs.unlinkPromise(targetPath));
      }
    }
    return Promise.all(queue).then(() => {
      xfs.removeSync(dir);
    });
  } catch (e) {
    if (e.code !== 'ENOENT') {
      throw e;
    }
  }
};

const ADD_CONCURRENT_LIMIT = 2;

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
}

const buildLocationTree = (locatorMap: NodeModulesLocatorMap): LocationTree => {
  const locationTree = new Map();

  for (const [locator, info] of locatorMap.entries()) {
    for (const location of info.locations) {
      const {locationRoot, segments} = parseLocation(location);
      let node = locationTree.get(locationRoot);
      if (!node) {
        node = { children: new Map() };
        locationTree.set(locationRoot, node);
      }
      for (let idx = 0; idx < segments.length; idx++) {
        const segment = segments[idx];
        const nextNode = node.children.get(segment);
        if (!nextNode) {
          const newNode: LocationNode = { children: new Map() };
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
}

const persistNodeModules = async (rootPath: PortablePath, prevLocatorMap: NodeModulesLocatorMap, locatorMap: NodeModulesLocatorMap, baseFs: FakeFS<PortablePath>, report: Report) => {
  const rootNmDirPath = ppath.join(rootPath, NODE_MODULES);
  const locatorStatePath = ppath.join(rootNmDirPath, LOCATOR_STATE_FILE);

  const prevLocationTree = buildLocationTree(prevLocatorMap);
  const locationTree = buildLocationTree(locatorMap);

  const addQueue: Promise<any>[] = [];
  const addModule = async ({srcDir, dstDir, linkType, keepNodeModules}: {srcDir: PortablePath, dstDir: PortablePath, linkType: LinkType, keepNodeModules: boolean}) => {
    const promise: Promise<any> = (async () => {
      try {
        await removeDir(dstDir, {excludeNodeModules: keepNodeModules});
        if (linkType === LinkType.SOFT) {
          xfs.mkdirpSync(ppath.dirname(dstDir));
          xfs.symlinkSync(srcDir, dstDir);
        } else {
          xfs.copySync(dstDir, srcDir, {baseFs});
        }
      } catch (e) {
        e.message = `While persisting ${srcDir} -> ${dstDir} ` + e.message;
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

  const deleteQueue: Promise<any>[] = [];
  const deleteModule = (dstDir: PortablePath) => {
    const promise = (async () => {
      try {
        await removeDir(dstDir);
      } catch (e) {
        e.message = `While persisting ${dstDir} ` + e.message;
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

      if (!prevTreeNode) {
        addList.push({srcDir, dstDir, linkType, keepNodeModules: false});
      } else {
        for (const segment of segments) {
          curLocation = ppath.join(curLocation, segment);
          prevTreeNode = prevTreeNode.children.get(segment);
          node = node!.children.get(segment);
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

  for (const entry of addList) {
    await addModule({...entry});
  }

  await Promise.all([addQueue, deleteQueue].map(queue => Promise.all(queue)));

  xfs.mkdirpSync(rootNmDirPath);
  await writeLocatorState(locatorStatePath, locatorMap);
};

