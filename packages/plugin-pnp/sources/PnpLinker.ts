import {miscUtils, structUtils, formatUtils, Descriptor, LocatorHash}                                        from '@yarnpkg/core';
import {FetchResult, Locator, Package}                                                                       from '@yarnpkg/core';
import {Linker, LinkOptions, MinimalLinkOptions, Manifest, MessageName, DependencyMeta, LinkType, Installer} from '@yarnpkg/core';
import {CwdFS, PortablePath, VirtualFS, npath, ppath, xfs, Filename}                                         from '@yarnpkg/fslib';
import {generateInlinedScript, generateSplitScript, PackageRegistry, PnpSettings}                            from '@yarnpkg/pnp';
import {UsageError}                                                                                          from 'clipanion';

import {getPnpPath}                                                                                          from './index';
import * as jsInstallUtils                                                                                   from './jsInstallUtils';
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
    const pnpPath = getPnpPath(opts.project).cjs;
    if (!xfs.existsSync(pnpPath))
      throw new UsageError(`The project in ${formatUtils.pretty(opts.project.configuration, `${opts.project.cwd}/package.json`, formatUtils.Type.PATH)} doesn't seem to have been installed - running an install there might help`);

    const pnpFile = miscUtils.dynamicRequireNoCache(pnpPath);

    const packageLocator = {name: structUtils.stringifyIdent(locator), reference: locator.reference};
    const packageInformation = pnpFile.getPackageInformation(packageLocator);

    if (!packageInformation)
      throw new UsageError(`Couldn't find ${structUtils.prettyLocator(opts.project.configuration, locator)} in the currently installed PnP map - running an install might help`);

    return npath.toPortablePath(packageInformation.packageLocation);
  }

  async findPackageLocator(location: PortablePath, opts: LinkOptions) {
    const pnpPath = getPnpPath(opts.project).cjs;
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

  private readonly virtualTemplates: Map<LocatorHash, {
    locator: Locator,
    location: PortablePath,
  }> = new Map();

  constructor(protected opts: LinkOptions) {
    this.opts = opts;
  }

  getCustomDataKey() {
    return JSON.stringify({
      name: `PnpInstaller`,
      version: 1,
    });
  }

  private customData: {
    store: Map<LocatorHash, CustomPackageData>,
  } = {
    store: new Map(),
  };

  attachCustomData(customData: any) {
    this.customData = customData;
  }

  async installPackage(pkg: Package, fetchResult: FetchResult) {
    const key1 = structUtils.stringifyIdent(pkg);
    const key2 = pkg.reference;

    const isWorkspace =
      !!this.opts.project.tryWorkspaceByLocator(pkg);

    const hasVirtualInstances =
      // Only packages with peer dependencies have virtual instances
      pkg.peerDependencies.size > 0 &&
      // Only packages with peer dependencies have virtual instances
      !structUtils.isVirtualLocator(pkg);

    const mayNeedToBeBuilt =
      // Virtual instance templates don't need to be built, since they don't truly exist
      !hasVirtualInstances &&
      // Workspaces aren't built by the linkers; they are managed by the core itself
      !isWorkspace;

    const mayNeedToBeUnplugged =
      // Virtual instance templates don't need to be unplugged, since they don't truly exist
      !hasVirtualInstances &&
      // We never need to unplug soft links, since we don't control them
      pkg.linkType !== LinkType.SOFT;

    let customPackageData = this.customData.store.get(pkg.locatorHash);
    if (typeof customPackageData === `undefined`) {
      customPackageData = await extractCustomPackageData(pkg, fetchResult);
      if (pkg.linkType === LinkType.HARD) {
        this.customData.store.set(pkg.locatorHash, customPackageData);
      }
    }

    const dependencyMeta = this.opts.project.getDependencyMeta(pkg, pkg.version);

    const buildScripts = mayNeedToBeBuilt
      ? jsInstallUtils.extractBuildScripts(pkg, customPackageData, dependencyMeta, {configuration: this.opts.project.configuration, report: this.opts.report})
      : [];

    const packageFs = mayNeedToBeUnplugged
      ? await this.unplugPackageIfNeeded(pkg, customPackageData, fetchResult, dependencyMeta)
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
        packageDependencies.set(structUtils.stringifyIdent(descriptor), null);
        packagePeers.add(structUtils.stringifyIdent(descriptor));
      }

      if (!this.opts.project.tryWorkspaceByLocator(pkg)) {
        const devirtualized = structUtils.devirtualizeLocator(pkg);
        this.virtualTemplates.set(devirtualized.locatorHash, {
          location: normalizeDirectoryPath(this.opts.project.cwd, VirtualFS.resolveVirtual(packageRawLocation)),
          locator: devirtualized,
        });
      }
    }

    miscUtils.getMapWithDefault(this.packageRegistry, key1).set(key2, {
      packageLocation,
      packageDependencies,
      packagePeers,
      linkType: pkg.linkType,
      discardFromLookup: fetchResult.discardFromLookup || false,
    });

    return {
      packageLocation: packageRawLocation,
      buildDirective: buildScripts.length > 0 ? buildScripts : null,
    };
  }

  async attachInternalDependencies(locator: Locator, dependencies: Array<[Descriptor, Locator]>) {
    const packageInformation = this.getPackageInformation(locator);

    for (const [descriptor, locator] of dependencies) {
      const target = !structUtils.areIdentsEqual(descriptor, locator)
        ? [structUtils.stringifyIdent(locator), locator.reference] as [string, string]
        : locator.reference;

      packageInformation.packageDependencies.set(structUtils.stringifyIdent(descriptor), target);
    }
  }

  async attachExternalDependents(locator: Locator, dependentPaths: Array<PortablePath>) {
    for (const dependentPath of dependentPaths) {
      const packageInformation = this.getDiskInformation(dependentPath);

      packageInformation.packageDependencies.set(structUtils.stringifyIdent(locator), locator.reference);
    }
  }


  async finalizeInstall() {
    const blacklistedPaths = new Set<PortablePath>();

    for (const {locator, location} of this.virtualTemplates.values()) {
      miscUtils.getMapWithDefault(this.packageRegistry, structUtils.stringifyIdent(locator)).set(locator.reference, {
        packageLocation: location,
        packageDependencies: new Map(),
        packagePeers: new Set(),
        linkType: LinkType.SOFT,
        discardFromLookup: false,
      });
    }

    this.packageRegistry.set(null, new Map([
      [null, this.getPackageInformation(this.opts.project.topLevelWorkspace.anchoredLocator)],
    ]));

    const pnpFallbackMode = this.opts.project.configuration.get(`pnpFallbackMode`);

    const blacklistedLocations = blacklistedPaths;
    const dependencyTreeRoots = this.opts.project.workspaces.map(({anchoredLocator}) => ({name: structUtils.stringifyIdent(anchoredLocator), reference: anchoredLocator.reference}));
    const enableTopLevelFallback = pnpFallbackMode !== `none`;
    const fallbackExclusionList = [];
    const fallbackPool = new Map();
    const ignorePattern = miscUtils.buildIgnorePattern([`.yarn/sdks/**`, ...this.opts.project.configuration.get(`pnpIgnorePatterns`)]);
    const packageRegistry = this.packageRegistry;
    const shebang = this.opts.project.configuration.get(`pnpShebang`);

    if (pnpFallbackMode === `dependencies-only`)
      for (const pkg of this.opts.project.storedPackages.values())
        if (this.opts.project.tryWorkspaceByLocator(pkg))
          fallbackExclusionList.push({name: structUtils.stringifyIdent(pkg), reference: pkg.reference});

    await this.finalizeInstallWithPnp({
      blacklistedLocations,
      dependencyTreeRoots,
      enableTopLevelFallback,
      fallbackExclusionList,
      fallbackPool,
      ignorePattern,
      packageRegistry,
      shebang,
    });

    return {
      customData: this.customData,
    };
  }

  async transformPnpSettings(pnpSettings: PnpSettings) {
    // Nothing to transform
  }

  async finalizeInstallWithPnp(pnpSettings: PnpSettings) {
    if (this.opts.project.configuration.get(`pnpMode`) !== this.mode)
      return;

    const pnpPath = getPnpPath(this.opts.project);
    const pnpDataPath = this.opts.project.configuration.get(`pnpDataPath`);

    if (xfs.existsSync(pnpPath.cjsLegacy)) {
      this.opts.report.reportWarning(MessageName.UNNAMED, `Removing the old ${formatUtils.pretty(this.opts.project.configuration, Filename.pnpJs, formatUtils.Type.PATH)} file. You might need to manually update existing references to reference the new ${formatUtils.pretty(this.opts.project.configuration, Filename.pnpCjs, formatUtils.Type.PATH)} file. If you use PnPify SDKs, you'll have to rerun ${formatUtils.pretty(this.opts.project.configuration, `yarn pnpify --sdk`, formatUtils.Type.CODE)}.`);

      await xfs.removePromise(pnpPath.cjsLegacy);
    }

    if (this.opts.project.configuration.get(`nodeLinker`) !== `pnp`) {
      await xfs.removePromise(pnpPath.cjs);
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

    await this.transformPnpSettings(pnpSettings);

    if (this.opts.project.configuration.get(`pnpEnableInlining`)) {
      const loaderFile = generateInlinedScript(pnpSettings);

      await xfs.changeFilePromise(pnpPath.cjs, loaderFile, {automaticNewlines: true});
      await xfs.chmodPromise(pnpPath.cjs, 0o755);

      await xfs.removePromise(pnpDataPath);
    } else {
      const dataLocation = ppath.relative(ppath.dirname(pnpPath.cjs), pnpDataPath);
      const {dataFile, loaderFile} = generateSplitScript({...pnpSettings, dataLocation});

      await xfs.changeFilePromise(pnpPath.cjs, loaderFile, {automaticNewlines: true});
      await xfs.chmodPromise(pnpPath.cjs, 0o755);

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

  private async unplugPackageIfNeeded(pkg: Package, customPackageData: CustomPackageData, fetchResult: FetchResult, dependencyMeta: DependencyMeta) {
    if (this.shouldBeUnplugged(pkg, customPackageData, dependencyMeta)) {
      return this.unplugPackage(pkg, fetchResult);
    } else {
      return fetchResult.packageFs;
    }
  }

  private shouldBeUnplugged(pkg: Package, customPackageData: CustomPackageData, dependencyMeta: DependencyMeta) {
    if (typeof dependencyMeta.unplugged !== `undefined`)
      return dependencyMeta.unplugged;

    if (FORCED_UNPLUG_PACKAGES.has(pkg.identHash))
      return true;

    if (customPackageData.manifest.preferUnplugged !== null)
      return customPackageData.manifest.preferUnplugged;

    if (jsInstallUtils.extractBuildScripts(pkg, customPackageData, dependencyMeta, {configuration: this.opts.project.configuration}).length > 0 || customPackageData.misc.extractHint)
      return true;

    return false;
  }

  private async unplugPackage(locator: Locator, fetchResult: FetchResult) {
    const unplugPath = pnpUtils.getUnpluggedPath(locator, {configuration: this.opts.project.configuration});
    this.unpluggedPaths.add(unplugPath);

    const readyFile = ppath.join(unplugPath, fetchResult.prefixPath, `.ready` as Filename);
    if (await xfs.existsPromise(readyFile))
      return new CwdFS(unplugPath);

    await xfs.mkdirPromise(unplugPath, {recursive: true});
    await xfs.copyPromise(unplugPath, PortablePath.dot, {baseFs: fetchResult.packageFs, overwrite: false});

    await xfs.writeFilePromise(readyFile, ``);

    return new CwdFS(unplugPath);
  }

  private getPackageInformation(locator: Locator) {
    const key1 = structUtils.stringifyIdent(locator);
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
}

function normalizeDirectoryPath(root: PortablePath, folder: PortablePath) {
  let relativeFolder = ppath.relative(root, folder);

  if (!relativeFolder.match(/^\.{0,2}\//))
    // Don't use ppath.join here, it ignores the `.`
    relativeFolder = `./${relativeFolder}` as PortablePath;

  return relativeFolder.replace(/\/?$/, `/`)  as PortablePath;
}

type UnboxPromise<T extends Promise<any>> = T extends Promise<infer U> ? U: never;
type CustomPackageData = UnboxPromise<ReturnType<typeof extractCustomPackageData>>;

async function extractCustomPackageData(pkg: Package, fetchResult: FetchResult) {
  const manifest = await Manifest.tryFind(fetchResult.prefixPath, {baseFs: fetchResult.packageFs}) ?? new Manifest();

  const preservedScripts = new Set([`preinstall`, `install`, `postinstall`]);
  for (const scriptName of manifest.scripts.keys())
    if (!preservedScripts.has(scriptName))
      manifest.scripts.delete(scriptName);

  return {
    manifest: {
      os: manifest.os,
      cpu: manifest.cpu,
      scripts: manifest.scripts,
      preferUnplugged: manifest.preferUnplugged,
    },
    misc: {
      extractHint: jsInstallUtils.getExtractHint(fetchResult),
      hasBindingGyp: jsInstallUtils.hasBindingGyp(fetchResult),
    },
  };
}
