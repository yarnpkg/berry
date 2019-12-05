import {Installer, Linker, LinkOptions, MinimalLinkOptions, Manifest, LinkType, MessageName} from '@yarnpkg/core';
import {FetchResult, Descriptor, Locator, Package, BuildDirective, BuildType}                from '@yarnpkg/core';
import {miscUtils, structUtils, Ident, DependencyMeta}                                       from '@yarnpkg/core';
import {PortablePath, npath, ppath, toFilename, Filename, xfs, FakeFS, CwdFS}                from '@yarnpkg/fslib';
import {NodeModulesTimestampsTree}                                                           from '@yarnpkg/pnpify/sources/buildNodeModulesTree';
import {PortableNodeModulesFS}                                                               from '@yarnpkg/pnpify';
import {PackageRegistry, makeRuntimeApi}                                                     from '@yarnpkg/pnp';
import {UsageError}                                                                          from 'clipanion';

import {Dirent, Stats}                                                                       from 'fs';

import {getPnpPath}                                                                          from './index';

const FORCED_UNPLUG_PACKAGES = new Set([
  // Some packages do weird stuff and MUST be unplugged. I don't like them.
  structUtils.makeIdent(null, `nan`).identHash,
  structUtils.makeIdent(null, `node-gyp`).identHash,
  structUtils.makeIdent(null, `node-pre-gyp`).identHash,
  structUtils.makeIdent(null, `node-addon-api`).identHash,
  // Those ones contain native builds (*.node), and Node loads them through dlopen
  structUtils.makeIdent(null, `fsevents`).identHash,
]);

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

    const buildScripts = await this.getBuildScripts(fetchResult);

    if (buildScripts.length > 0 && !this.opts.project.configuration.get(`enableScripts`)) {
      this.opts.report.reportWarningOnce(MessageName.DISABLED_BUILD_SCRIPTS, `${structUtils.prettyLocator(this.opts.project.configuration, pkg)} lists build scripts, but all build scripts have been disabled.`);
      buildScripts.length = 0;
    }

    if (buildScripts.length > 0 && pkg.linkType !== LinkType.HARD && !this.opts.project.tryWorkspaceByLocator(pkg)) {
      this.opts.report.reportWarningOnce(MessageName.SOFT_LINK_BUILD, `${structUtils.prettyLocator(this.opts.project.configuration, pkg)} lists build scripts, but is referenced through a soft link. Soft links don't support build scripts, so they'll be ignored.`);
      buildScripts.length = 0;
    }

    const dependencyMeta = this.opts.project.getDependencyMeta(pkg, pkg.version);

    if (buildScripts.length > 0 && dependencyMeta && dependencyMeta.built === false) {
      this.opts.report.reportInfoOnce(MessageName.BUILD_DISABLED, `${structUtils.prettyLocator(this.opts.project.configuration, pkg)} lists build scripts, but its build has been explicitly disabled through configuration.`);
      buildScripts.length = 0;
    }

    const hasVirtualInstances =
      pkg.peerDependencies.size > 0 &&
      !structUtils.isVirtualLocator(pkg) &&
      !this.opts.project.tryWorkspaceByLocator(pkg);

    const packageFs = !hasVirtualInstances && pkg.linkType !== LinkType.SOFT && (buildScripts.length > 0 || this.isUnplugged(pkg, dependencyMeta))
      ? await this.unplugPackage(pkg, fetchResult.packageFs)
      : fetchResult.packageFs;

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

    if (hasVirtualInstances)
      this.blacklistedPaths.add(packageLocation);

    return {
      packageLocation,
      buildDirective: buildScripts.length > 0 ? buildScripts as BuildDirective[] : null,
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

    const pnp = makeRuntimeApi(pnpSettings, this.opts.project.cwd);
    const nodeModulesFS = new PortableNodeModulesFS(pnp, {pnpifyFs: false});
    persistNodeModules(this.opts.project.cwd, nodeModulesFS);
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

const persistDirEntry = (parentPath: PortablePath, entryName: string, baseFs: PortableNodeModulesFS, mtime: Date, children: NodeModulesTimestampsTree, dirent?: Dirent) => {
  const fullPath = ppath.join(parentPath, toFilename(entryName));
  if (!dirent || dirent.isDirectory()) {
    xfs.mkdirSync(fullPath);

    const entries = baseFs.readdirSync(fullPath, {withFileTypes: true});
    for (const entry of entries) {
      const node = children.get(toFilename(entry.name));
      const entryMtime = node ? node.mtime : mtime;
      const entryChildren = node ? node.children : children;
      persistDirEntry(fullPath, entry.name, baseFs, entryMtime, entryChildren, entry);
    }

    xfs.utimesSync(fullPath, mtime, mtime);
    xfs.chmodSync(fullPath, 0o777);
  } else if (dirent) {
    if (dirent.isFile()) {
      const content = baseFs.readFileSync(fullPath);
      xfs.writeFileSync(fullPath, content);
    } else if (dirent.isSymbolicLink()) {
      const target = baseFs.readlinkSync(fullPath);
      xfs.symlinkSync(target, fullPath);
    } else {
      throw new Error(`Unsupported file type (file: ${fullPath})`);
    }
  }
};

const wasModuleDirChanged = (dir: PortablePath, stats: Stats, mtime: Date, ignoreRegexp: RegExp, excludeNodeModules: boolean): boolean => {
  if (+stats.mtime !== +mtime) {
    return true;
  } else {
    const entries = xfs.readdirSync(dir);
    for (const entry of entries) {
      const entryPath = ppath.join(dir, entry);
      const stats = xfs.lstatSync(entryPath);
      if (stats.isDirectory() && !ignoreRegexp.test(entryPath) && (!excludeNodeModules || entry !== 'node_modules') && wasModuleDirChanged(entryPath, stats, mtime, ignoreRegexp, false)) {
        return true;
      }
    }
    return false;
  }
};

const persistNodeModules = (rootPath: PortablePath, nodeModulesFS: PortableNodeModulesFS): NodeModulesTimestampsTree => {
  const newTsTree = new Map();
  const tsTree = nodeModulesFS.getNodeModulesDirTimestamps();
  const NODE_MODULES = toFilename('node_modules');
  const DEL_BLACKLIST = /\/(node_modules\/\.|__ivy_ngcc__(\/|$))/;

  const persistNode = (parentPath: PortablePath, dir: Filename, mtime: Date, children: NodeModulesTimestampsTree) => {
    const nodePath = ppath.join(parentPath, dir);
    let stats;
    try {
      stats = xfs.lstatSync(nodePath);
    } catch (e) {
      if (e.code !== 'ENOENT') {
        throw e;
      }
    }
    // Non existing directory
    if (!stats) {
      persistDirEntry(parentPath, dir, nodeModulesFS, mtime, children);
      // Existing directory
    } else {
      const hasInnerNodeModules = (children.size === 1 && children.has(NODE_MODULES));
      // Changed module directory
      if ((children.size === 0 || hasInnerNodeModules) && wasModuleDirChanged(nodePath, stats, mtime, DEL_BLACKLIST, hasInnerNodeModules)) {
        if (!hasInnerNodeModules) {
          // Module has no inner node_modules, remove module dir
          xfs.removeSync(nodePath);
          // Persist module dir
          persistDirEntry(parentPath, dir, nodeModulesFS, mtime, children);
        } else {
          // Module has inner node_modules, remove everything except inner node_modules
          const dstEntryNames = xfs.readdirSync(nodePath);
          for (const entry of dstEntryNames) {
            const entryPath = ppath.join(nodePath, entry);
            if (entry !== NODE_MODULES && !DEL_BLACKLIST.test(entryPath)) {
              xfs.removeSync(entryPath);
            }
          }
          // Persist everything, except inner node_modules
          const srcEntries = nodeModulesFS.readdirSync(nodePath, {withFileTypes: true});
          for (const entry of srcEntries) {
            if (entry.name !== NODE_MODULES) {
              persistDirEntry(nodePath, entry.name, nodeModulesFS, mtime, children, entry);
            }
          }
          // Persist inner node_modules
          const node = children.get(NODE_MODULES)!;
          persistNode(nodePath, NODE_MODULES, node.mtime, node.children);
        }
        // Changed container directory
      } else if (+stats.mtime !== +mtime) {
        const srcEntryNames = new Set(children.keys());
        const dstEntryNames = new Set(stats ? xfs.readdirSync(nodePath) : []);

        for (const [entry, node] of children.entries()) {
          if (!dstEntryNames.has(entry)) {
            // Add new directories
            persistDirEntry(nodePath, entry, nodeModulesFS, node.mtime, node.children);
          } else {
            // Check directories with the same name for changes
            persistNode(nodePath, entry, node.mtime, node.children);
          }
        }

        for (const entry of dstEntryNames) {
          const entryDir = ppath.join(nodePath, entry);
          if (!srcEntryNames.has(entry)) {
            // Remove old directories
            xfs.removeSync(entryDir);
          }
        }
        xfs.utimesSync(nodePath, mtime, mtime);
      } else {
        // Unchanged container dir
        for (const [entry, node] of children.entries()) {
          persistNode(nodePath, entry, node.mtime, node.children);
        }
      }
    }
  };

  let nmStats;

  const rootNmDirPath = ppath.join(rootPath, NODE_MODULES);
  try {
    nmStats = nodeModulesFS.lstatSync(rootNmDirPath);
  } catch (e) {
    if (e.code !== 'ENOENT') {
      throw e;
    }
  }

  if (!nmStats) {
    xfs.removeSync(rootNmDirPath);
  } else {
    const node = tsTree.get(NODE_MODULES)!;
    persistNode(rootPath, NODE_MODULES, node.mtime, node.children);
  }

  return newTsTree;
};

