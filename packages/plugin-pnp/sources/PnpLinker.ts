import {miscUtils, structUtils, formatUtils, BuildDirective, Descriptor}                                     from '@yarnpkg/core';
import {FetchResult, Ident, Locator, Package}                                                                from '@yarnpkg/core';
import {Linker, LinkOptions, MinimalLinkOptions, Manifest, MessageName, DependencyMeta, LinkType, Installer} from '@yarnpkg/core';
import {CwdFS, FakeFS, PortablePath, npath, ppath, xfs, Filename}                                            from '@yarnpkg/fslib';
import {generateInlinedScript, generateSplitScript, PackageRegistry, PnpSettings}                            from '@yarnpkg/pnp';
import {UsageError}                                                                                          from 'clipanion';

import {getPnpPath, javascriptUtils}                                                                         from './index';
import * as pnpUtils                                                                                         from './pnpUtils';

const FORCED_UNPLUG_PACKAGES = new Set([
  // Some packages do weird stuff and MUST be unplugged. I don't like them.
  structUtils.makeIdent(null, `nan`).identHash,
  structUtils.makeIdent(null, `node-gyp`).identHash,
  structUtils.makeIdent(null, `node-pre-gyp`).identHash,
  structUtils.makeIdent(null, `node-addon-api`).identHash,
  // Those ones contain native builds (*.node), and Node loads them through dlopen
  structUtils.makeIdent(null, `fsevents`).identHash,
]);

const FORCED_UNPLUG_FILETYPES = new Set([
  // Windows can't execute exe files inside zip archives
  `.exe`,
  // The c/c++ compiler can't read files from zip archives
  `.h`, `.hh`, `.hpp`, `.c`, `.cc`, `.cpp`,
  // The java runtime can't read files from zip archives
  `.java`, `.jar`,
  // Node opens these through dlopen
  `.node`,
]);

export class PnpLinker implements Linker {
  protected mode = `strict`;

  supportsPackage(pkg: Package, opts: MinimalLinkOptions) {
    if (opts.project.configuration.get(`nodeLinker`) !== `pnp`)
      return false;

    if (opts.project.configuration.get(`pnpMode`) !== this.mode)
      return false;

    return true;
  }

  async findPackageLocation(locator: Locator, opts: LinkOptions) {
    const pnpPath = getPnpPath(opts.project).main;
    if (!xfs.existsSync(pnpPath))
      throw new UsageError(`The project in ${formatUtils.pretty(opts.project.configuration, `${opts.project.cwd}/package.json`, formatUtils.Type.PATH)} doesn't seem to have been installed - running an install there might help`);

    const pnpFile = miscUtils.dynamicRequireNoCache(pnpPath);

    const packageLocator = {name: structUtils.requirableIdent(locator), reference: locator.reference};
    const packageInformation = pnpFile.getPackageInformation(packageLocator);

    if (!packageInformation)
      throw new UsageError(`Couldn't find ${structUtils.prettyLocator(opts.project.configuration, locator)} in the currently installed PnP map - running an install might help`);

    return npath.toPortablePath(packageInformation.packageLocation);
  }

  async findPackageLocator(location: PortablePath, opts: LinkOptions) {
    const pnpPath = getPnpPath(opts.project).main;
    if (!xfs.existsSync(pnpPath))
      return null;

    const physicalPath = npath.fromPortablePath(pnpPath);
    const pnpFile = miscUtils.dynamicRequire(physicalPath);
    delete require.cache[physicalPath];

    const locator = pnpFile.findPackageLocator(npath.fromPortablePath(location));
    if (!locator)
      return null;

    return structUtils.makeLocator(structUtils.parseIdent(locator.name), locator.reference);
  }

  makeInstaller(opts: LinkOptions) {
    return new PnpInstaller(opts);
  }
}

export class PnpInstaller implements Installer {
  protected mode = `strict`;

  private readonly packageRegistry: PackageRegistry = new Map();
  private readonly blacklistedPaths: Set<PortablePath> = new Set();

  constructor(private opts: LinkOptions) {
    this.opts = opts;
  }

  async installPackage(pkg: Package, fetchResult: FetchResult) {
    const key1 = structUtils.requirableIdent(pkg);
    const key2 = pkg.reference;

    const hasVirtualInstances =
      pkg.peerDependencies.size > 0 &&
      !structUtils.isVirtualLocator(pkg) &&
      !this.opts.project.tryWorkspaceByLocator(pkg);

    const manifest = !hasVirtualInstances
      ? await Manifest.tryFind(fetchResult.prefixPath, {baseFs: fetchResult.packageFs})
      : null;

    const dependencyMeta = this.opts.project.getDependencyMeta(pkg, pkg.version);

    const buildScripts = manifest !== null && !hasVirtualInstances && !this.opts.project.tryWorkspaceByLocator(pkg)
      ? javascriptUtils.extractBuildScripts(pkg, fetchResult, manifest, dependencyMeta, {configuration: this.opts.project.configuration, report: this.opts.report})
      : [];

    const packageFs = !hasVirtualInstances && pkg.linkType !== LinkType.SOFT
      ? await this.unplugPackageIfNeeded(pkg, manifest, fetchResult, dependencyMeta, {hasBuildScripts: buildScripts.length > 0})
      : fetchResult.packageFs;

    if (ppath.isAbsolute(fetchResult.prefixPath))
      throw new Error(`Assertion failed: Expected the prefix path (${fetchResult.prefixPath}) to be relative to the parent`);

    const packageRawLocation = ppath.resolve(packageFs.getRealPath(), fetchResult.prefixPath);

    const packageLocation = normalizeDirectoryPath(this.opts.project.cwd, packageRawLocation);
    const packageDependencies = new Map<string, string | [string, string] | null>();
    const packagePeers = new Set<string>();

    // Only virtual packages should have effective peer dependencies, but the
    // workspaces are a special case because the original packages are kept in
    // the dependency tree even after being virtualized; so in their case we
    // just ignore their declared peer dependencies.
    if (structUtils.isVirtualLocator(pkg)) {
      for (const descriptor of pkg.peerDependencies.values()) {
        packageDependencies.set(structUtils.requirableIdent(descriptor), null);
        packagePeers.add(structUtils.stringifyIdent(descriptor));
      }
    }

    miscUtils.getMapWithDefault(this.packageRegistry, key1).set(key2, {
      packageLocation,
      packageDependencies,
      packagePeers,
      linkType: pkg.linkType,
      discardFromLookup: fetchResult.discardFromLookup || false,
    });

    if (hasVirtualInstances)
      this.blacklistedPaths.add(packageLocation);

    return {
      packageLocation: packageRawLocation,
      buildDirective: buildScripts.length > 0 ? buildScripts as Array<BuildDirective> : null,
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
    this.trimBlacklistedPackages();

    this.packageRegistry.set(null, new Map([
      [null, this.getPackageInformation(this.opts.project.topLevelWorkspace.anchoredLocator)],
    ]));

    const pnpFallbackMode = this.opts.project.configuration.get(`pnpFallbackMode`);

    const blacklistedLocations = this.blacklistedPaths;
    const dependencyTreeRoots = this.opts.project.workspaces.map(({anchoredLocator}) => ({name: structUtils.requirableIdent(anchoredLocator), reference: anchoredLocator.reference}));
    const enableTopLevelFallback = pnpFallbackMode !== `none`;
    const fallbackExclusionList = [];
    const fallbackPool = new Map();
    const ignorePattern = miscUtils.buildIgnorePattern([`.yarn/sdks/**`, ...this.opts.project.configuration.get(`pnpIgnorePatterns`)]);
    const packageRegistry = this.packageRegistry;
    const shebang = this.opts.project.configuration.get(`pnpShebang`);

    if (pnpFallbackMode === `dependencies-only`)
      for (const pkg of this.opts.project.storedPackages.values())
        if (this.opts.project.tryWorkspaceByLocator(pkg))
          fallbackExclusionList.push({name: structUtils.requirableIdent(pkg), reference: pkg.reference});

    return await this.finalizeInstallWithPnp({
      blacklistedLocations,
      dependencyTreeRoots,
      enableTopLevelFallback,
      fallbackExclusionList,
      fallbackPool,
      ignorePattern,
      packageRegistry,
      shebang,
    });
  }

  async finalizeInstallWithPnp(pnpSettings: PnpSettings) {
    if (this.opts.project.configuration.get(`pnpMode`) !== this.mode)
      return;

    const pnpPath = getPnpPath(this.opts.project);
    const pnpDataPath = this.opts.project.configuration.get(`pnpDataPath`);

    await xfs.removePromise(pnpPath.other);

    if (this.opts.project.configuration.get(`nodeLinker`) !== `pnp`) {
      await xfs.removePromise(pnpPath.main);
      await xfs.removePromise(pnpDataPath);

      return;
    }

    const nodeModules = await this.locateNodeModules(pnpSettings.ignorePattern);
    if (nodeModules.length > 0) {
      this.opts.report.reportWarning(MessageName.DANGEROUS_NODE_MODULES, `One or more node_modules have been detected and will be removed. This operation may take some time.`);
      for (const nodeModulesPath of nodeModules) {
        await xfs.removePromise(nodeModulesPath);
      }
    }

    if (this.opts.project.configuration.get(`pnpEnableInlining`)) {
      const loaderFile = generateInlinedScript(pnpSettings);

      await xfs.changeFilePromise(pnpPath.main, loaderFile, {automaticNewlines: true});
      await xfs.chmodPromise(pnpPath.main, 0o755);

      await xfs.removePromise(pnpDataPath);
    } else {
      const dataLocation = ppath.relative(ppath.dirname(pnpPath.main), pnpDataPath);
      const {dataFile, loaderFile} = generateSplitScript({...pnpSettings, dataLocation});

      await xfs.changeFilePromise(pnpPath.main, loaderFile, {automaticNewlines: true});
      await xfs.chmodPromise(pnpPath.main, 0o755);

      await xfs.changeFilePromise(pnpDataPath, dataFile, {automaticNewlines: true});
      await xfs.chmodPromise(pnpDataPath, 0o644);
    }

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
  }

  private async locateNodeModules(ignorePattern?: string | null) {
    const nodeModules: Array<PortablePath> = [];
    const ignoreRegExp = ignorePattern ? new RegExp(ignorePattern) : null;

    for (const workspace of this.opts.project.workspaces) {
      const nodeModulesPath = ppath.join(workspace.cwd, `node_modules` as Filename);
      if (ignoreRegExp && ignoreRegExp.test(ppath.relative(this.opts.project.cwd, workspace.cwd)) || !xfs.existsSync(nodeModulesPath))
        continue;

      const directoryListing = await xfs.readdirPromise(nodeModulesPath, {
        withFileTypes: true,
      });

      const nonCacheEntries = directoryListing.filter(entry => {
        return !entry.isDirectory() || entry.name === `.bin` || !entry.name.startsWith(`.`);
      });

      if (nonCacheEntries.length === directoryListing.length) {
        nodeModules.push(nodeModulesPath);
      } else {
        for (const entry of nonCacheEntries) {
          nodeModules.push(ppath.join(nodeModulesPath, entry.name));
        }
      }
    }

    return nodeModules;
  }

  private readonly unpluggedPaths: Set<string> = new Set();

  private async unplugPackageIfNeeded(locator: Locator, manifest: Manifest | null, fetchResult: FetchResult, dependencyMeta: DependencyMeta, {hasBuildScripts}: {hasBuildScripts: boolean}) {
    if (this.shouldBeUnplugged(locator, manifest, fetchResult, dependencyMeta, {hasBuildScripts})) {
      return this.unplugPackage(locator, fetchResult.packageFs);
    } else {
      return fetchResult.packageFs;
    }
  }

  private shouldBeUnplugged(ident: Ident, manifest: Manifest | null, fetchResult: FetchResult, dependencyMeta: DependencyMeta, {hasBuildScripts}: {hasBuildScripts: boolean}) {
    if (typeof dependencyMeta.unplugged !== `undefined`)
      return dependencyMeta.unplugged;

    if (FORCED_UNPLUG_PACKAGES.has(ident.identHash))
      return true;

    if (manifest !== null && manifest.preferUnplugged !== null)
      return manifest.preferUnplugged;

    if (hasBuildScripts || fetchResult.packageFs.getExtractHint({relevantExtensions:FORCED_UNPLUG_FILETYPES}))
      return true;

    return false;
  }

  private async unplugPackage(locator: Locator, packageFs: FakeFS<PortablePath>) {
    const unplugPath = pnpUtils.getUnpluggedPath(locator, {configuration: this.opts.project.configuration});
    this.unpluggedPaths.add(unplugPath);

    await xfs.mkdirPromise(unplugPath, {recursive: true});
    await xfs.copyPromise(unplugPath, PortablePath.dot, {baseFs: packageFs, overwrite: false});

    return new CwdFS(unplugPath);
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
    const packageStore = miscUtils.getMapWithDefault(this.packageRegistry, `@@disk`);
    const normalizedPath = normalizeDirectoryPath(this.opts.project.cwd, path);

    return miscUtils.getFactoryWithDefault(packageStore, normalizedPath, () => ({
      packageLocation: normalizedPath,
      packageDependencies: new Map(),
      packagePeers: new Set<string>(),
      linkType: LinkType.SOFT,
      discardFromLookup: false,
    }));
  }

  private trimBlacklistedPackages() {
    for (const packageStore of this.packageRegistry.values()) {
      for (const [key2, packageInformation] of packageStore) {
        if (packageInformation.packageLocation && this.blacklistedPaths.has(packageInformation.packageLocation)) {
          packageStore.delete(key2);
        }
      }
    }
  }
}

function normalizeDirectoryPath(root: PortablePath, folder: PortablePath) {
  let relativeFolder = ppath.relative(root, folder);

  if (!relativeFolder.match(/^\.{0,2}\//))
    // Don't use ppath.join here, it ignores the `.`
    relativeFolder = `./${relativeFolder}` as PortablePath;

  return relativeFolder.replace(/\/?$/, `/`)  as PortablePath;
}
