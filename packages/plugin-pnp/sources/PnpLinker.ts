import {Installer, Linker, LinkOptions, MinimalLinkOptions, Manifest, LinkType, MessageName, DependencyMeta} from '@berry/core';
import {FetchResult, Descriptor, Ident, Locator, Package, BuildDirective, BuildType}                         from '@berry/core';
import {miscUtils, structUtils}                                                                              from '@berry/core';
import {CwdFS, FakeFS, NodeFS, xfs, PortablePath, ppath, toFilename}                                         from '@berry/fslib';
import {PackageRegistry, generateInlinedScript, generateSplitScript}                                         from '@berry/pnp';

// Some packages do weird stuff and MUST be unplugged. I don't like them.
const FORCED_UNPLUG_PACKAGES = new Set([
  structUtils.makeIdent(null, `nan`).identHash,
  structUtils.makeIdent(null, `node-gyp`).identHash,
  structUtils.makeIdent(null, `node-pre-gyp`).identHash,
  structUtils.makeIdent(null, `node-addon-api`).identHash,
]);

export class PnpLinker implements Linker {
  supportsPackage(pkg: Package, opts: MinimalLinkOptions) {
    return true;
  }

  async findPackageLocation(locator: Locator, opts: LinkOptions) {
    const pnpPath = opts.project.configuration.get(`pnpPath`);
    if (!xfs.existsSync(pnpPath))
      throw new Error(`Couldn't find the PnP package map at the root of the project - run an install to generate it`);

    const physicalPath = NodeFS.fromPortablePath(pnpPath);
    const pnpFile = miscUtils.dynamicRequire(physicalPath);
    delete require.cache[physicalPath];

    const packageLocator = {name: structUtils.requirableIdent(locator), reference: locator.reference};
    const packageInformation = pnpFile.getPackageInformation(packageLocator);

    if (!packageInformation)
      throw new Error(`Couldn't find ${structUtils.prettyLocator(opts.project.configuration, locator)} in the currently installed pnp map`);

    return NodeFS.toPortablePath(packageInformation.packageLocation);
  }

  async findPackageLocator(location: PortablePath, opts: LinkOptions) {
    const pnpPath = opts.project.configuration.get(`pnpPath`);
    if (!xfs.existsSync(pnpPath))
      throw new Error(`Couldn't find the PnP package map at the root of the project - run an install to generate it`);

    const physicalPath = NodeFS.fromPortablePath(pnpPath);
    const pnpFile = miscUtils.dynamicRequire(physicalPath);
    delete require.cache[physicalPath];

    const locator = pnpFile.findPackageLocator(NodeFS.fromPortablePath(location));
    if (!locator)
      return null;

    return structUtils.makeLocator(structUtils.parseIdent(locator.name), locator.reference);
  }

  makeInstaller(opts: LinkOptions) {
    return new PnpInstaller(opts);
  }
}

class PnpInstaller implements Installer {
  private readonly packageRegistry: PackageRegistry = new Map();
  private readonly unpluggedPaths: Set<string> = new Set();

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

    const packageFs = pkg.linkType !== LinkType.SOFT && (buildScripts.length > 0 || this.isUnplugged(pkg, dependencyMeta))
      ? await this.unplugPackage(pkg, fetchResult.packageFs)
      : fetchResult.packageFs;

    const packageRawLocation = ppath.resolve(packageFs.getRealPath(), ppath.relative(PortablePath.root, fetchResult.prefixPath));

    const packageLocation = this.normalizeDirectoryPath(packageRawLocation);
    const packageDependencies = new Map();

    for (const descriptor of pkg.peerDependencies.values())
      packageDependencies.set(structUtils.requirableIdent(descriptor), null);

    const packageStore = this.getPackageStore(key1);
    packageStore.set(key2, {packageLocation, packageDependencies});

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
    if (await this.shouldWarnNodeModules())
      this.opts.report.reportWarning(MessageName.DANGEROUS_NODE_MODULES, `One or more node_modules have been detected; they risk hiding legitimate problems until your application reaches production.`);

    this.packageRegistry.set(null, new Map([
      [null, this.getPackageInformation(this.opts.project.topLevelWorkspace.anchoredLocator)],
    ]));

    const pnpFallbackMode = this.opts.project.configuration.get(`pnpFallbackMode`);

    const blacklistedLocations = new Set<string>();
    const enableTopLevelFallback = pnpFallbackMode !== `none`;
    const fallbackExclusionList = [];
    const ignorePattern = this.opts.project.configuration.get(`pnpIgnorePattern`);
    const packageRegistry = this.packageRegistry;
    const shebang = this.opts.project.configuration.get(`pnpShebang`);

    if (pnpFallbackMode === `dependencies-only`)
      for (const pkg of this.opts.project.storedPackages.values())
        if (this.opts.project.tryWorkspaceByLocator(pkg))
          fallbackExclusionList.push({name: structUtils.requirableIdent(pkg), reference: pkg.reference});

    const pnpPath = this.opts.project.configuration.get(`pnpPath`);
    const pnpDataPath = this.opts.project.configuration.get(`pnpDataPath`);

    const pnpSettings = {blacklistedLocations, enableTopLevelFallback, fallbackExclusionList, ignorePattern, packageRegistry, shebang};

    if (this.opts.project.configuration.get(`pnpEnableInlining`)) {
      const loaderFile = generateInlinedScript(pnpSettings);

      await xfs.changeFilePromise(pnpPath, loaderFile);
      await xfs.chmodPromise(pnpPath, 0o755);

      await xfs.removePromise(pnpDataPath);
    } else {
      const dataLocation = ppath.relative(ppath.dirname(pnpPath), pnpDataPath);
      const {dataFile, loaderFile} = generateSplitScript({...pnpSettings, dataLocation});

      await xfs.changeFilePromise(pnpPath, loaderFile);
      await xfs.chmodPromise(pnpPath, 0o755);

      await xfs.changeFilePromise(pnpDataPath, dataFile);
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
      });
    }

    return diskInformation;
  }

  private async shouldWarnNodeModules() {
    for (const workspace of this.opts.project.workspaces) {
      const nodeModulesPath = ppath.join(workspace.cwd, toFilename(`node_modules`));
      if (!xfs.existsSync(nodeModulesPath))
        continue;

      const directoryListing = await xfs.readdirPromise(nodeModulesPath);
      if (directoryListing.every(entry => entry.startsWith(`.`)))
        continue;

      return true;
    }

    return false;
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
