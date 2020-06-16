import {Installer, LinkOptions, LinkType, MessageName, DependencyMeta, FinalizeInstallStatus, Manifest} from '@yarnpkg/core';
import {FetchResult, Descriptor, Locator, Package, BuildDirective}                                      from '@yarnpkg/core';
import {miscUtils, structUtils}                                                                         from '@yarnpkg/core';
import {FakeFS, PortablePath, ppath}                                                                    from '@yarnpkg/fslib';
import {PackageRegistry, PnpSettings}                                                                   from '@yarnpkg/pnp';

export type AbstractInstallerOptions = LinkOptions & {
  skipIncompatiblePackageLinking?: boolean;
};

export abstract class AbstractPnpInstaller implements Installer {
  private readonly packageRegistry: PackageRegistry = new Map();

  private readonly blacklistedPaths: Set<PortablePath> = new Set();

  constructor(protected opts: AbstractInstallerOptions) {
    this.opts = opts;
  }

  /**
   * Called in order to know whether the specified package has build scripts.
   */
  abstract getBuildScripts(locator: Locator, manifest: Manifest | null, fetchResult: FetchResult): Promise<Array<BuildDirective>>;

  /**
   * Called to transform the package before it's stored in the PnP map. For
   * example we use this in the PnP linker to materialize the packages within
   * their own directories when they have build scripts.
   */
  abstract transformPackage(locator: Locator, manifest: Manifest | null, fetchResult: FetchResult, dependencyMeta: DependencyMeta, flags: {hasBuildScripts: boolean}): Promise<FakeFS<PortablePath>>;

  /**
   * Called with the full settings, ready to be used by the @yarnpkg/pnp
   * package.
   */
  abstract finalizeInstallWithPnp(pnpSettings: PnpSettings): Promise<Array<FinalizeInstallStatus> | void>;

  private checkAndReportManifestIncompatibility(manifest: Manifest | null, pkg: Package): boolean {
    if (manifest && !manifest.isCompatibleWithOS(process.platform)) {
      this.opts.report.reportWarningOnce(MessageName.INCOMPATIBLE_OS, `${structUtils.prettyLocator(this.opts.project.configuration, pkg)} The platform ${process.platform} is incompatible with this module, ${this.opts.skipIncompatiblePackageLinking ? `linking` : `building`} skipped.`);
      return false;
    }

    if (manifest && !manifest.isCompatibleWithCPU(process.arch)) {
      this.opts.report.reportWarningOnce(MessageName.INCOMPATIBLE_CPU, `${structUtils.prettyLocator(this.opts.project.configuration, pkg)} The CPU architecture ${process.arch} is incompatible with this module, ${this.opts.skipIncompatiblePackageLinking ? `linking` : `building`} skipped.`);
      return false;
    }

    return true;
  }

  async installPackage(pkg: Package, fetchResult: FetchResult) {
    const key1 = structUtils.requirableIdent(pkg);
    const key2 = pkg.reference;

    const hasVirtualInstances =
      pkg.peerDependencies.size > 0 &&
      !structUtils.isVirtualLocator(pkg) &&
      !this.opts.project.tryWorkspaceByLocator(pkg);

    const manifest = !hasVirtualInstances || this.opts.skipIncompatiblePackageLinking
      ? await Manifest.tryFind(fetchResult.prefixPath, {baseFs: fetchResult.packageFs})
      : null;
    const isManifestCompatible = this.checkAndReportManifestIncompatibility(manifest, pkg);
    if (this.opts.skipIncompatiblePackageLinking && !isManifestCompatible)
      return {packageLocation: null, buildDirective: null};

    const buildScripts = !hasVirtualInstances
      ? await this.getBuildScripts(pkg, manifest, fetchResult)
      : [];

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

    const packageFs = !hasVirtualInstances && pkg.linkType !== LinkType.SOFT
      ? await this.transformPackage(pkg, manifest, fetchResult, dependencyMeta, {hasBuildScripts: buildScripts.length > 0})
      : fetchResult.packageFs;

    if (ppath.isAbsolute(fetchResult.prefixPath))
      throw new Error(`Assertion failed: Expected the prefix path (${fetchResult.prefixPath}) to be relative to the parent`);

    const packageRawLocation = ppath.resolve(packageFs.getRealPath(), fetchResult.prefixPath);

    const packageLocation = this.normalizeDirectoryPath(packageRawLocation);
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
      buildDirective: buildScripts.length > 0 && isManifestCompatible ? buildScripts as Array<BuildDirective> : null,
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
    const fallbackPool = this.getPackageInformation(this.opts.project.topLevelWorkspace.anchoredLocator).packageDependencies;
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
    const normalizedPath = this.normalizeDirectoryPath(path);

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

  private normalizeDirectoryPath(folder: PortablePath) {
    let relativeFolder = ppath.relative(this.opts.project.cwd, folder);

    if (!relativeFolder.match(/^\.{0,2}\//))
      // Don't use ppath.join here, it ignores the `.`
      relativeFolder = `./${relativeFolder}` as PortablePath;

    return relativeFolder.replace(/\/?$/, `/`)  as PortablePath;
  }
}
