import {Installer, Linker, LinkOptions, MinimalLinkOptions, Manifest, LinkType, MessageName}  from '@berry/core';
import {LocatorHash, Locator, Package}                                                        from '@berry/core';
import {miscUtils, structUtils}                                                               from '@berry/core';
import {PackageInformationStores, LocationBlacklist, TemplateReplacements, generatePnpScript} from '@berry/pnp';
import {CwdFS, FakeFS, NodeFS}                                                                from '@berry/zipfs';
import {posix}                                                                                from 'path';

const UNPLUGGED_PACKAGES = new Set([
  structUtils.makeIdent(null, `node-pre-gyp`).identHash,
]);

export class PnpLinker implements Linker {
  supports(pkg: Package, opts: MinimalLinkOptions) {
    return true;
  }

  async findPackage(locator: Locator, opts: LinkOptions) {
    const fs = new NodeFS();

    if (!await fs.existsPromise(opts.project.configuration.pnpPath))
      throw new Error(`Couldn't find the PnP package map at the root of the project - run an install to generate it`);

    const pnpFile = miscUtils.dynamicRequire(opts.project.configuration.pnpPath);
    delete require.cache[opts.project.configuration.pnpPath];

    const packageLocator = {name: structUtils.requirableIdent(locator), reference: locator.reference};
    const packageInformation = pnpFile.getPackageInformation(packageLocator);

    if (!packageInformation)
      throw new Error(`Couldn't find ${structUtils.prettyLocator(opts.project.configuration, locator)} in the currently installed pnp map`);

    return packageInformation.packageLocation;
  }

  makeInstaller(opts: LinkOptions) {
    return new PnpInstaller(opts);
  }
}

class PnpInstaller implements Installer {
  private readonly packageInformationStores: PackageInformationStores = new Map();

  private readonly opts: LinkOptions;

  constructor(opts: LinkOptions) {
    this.opts = opts;
  }

  async installPackage(locator: Locator, linkType: LinkType, packageFs: FakeFS) {
    const key1 = structUtils.requirableIdent(locator);
    const key2 = locator.reference;

    const buildScripts = await this.getBuildScripts(packageFs);

    if (buildScripts.length > 0 && !this.opts.project.configuration.enableScripts) {
      this.opts.report.reportInfo(MessageName.DISABLED_BUILD_SCRIPTS, `${structUtils.prettyLocator(this.opts.project.configuration, locator)} lists build scripts, but all build scripts have been disabled.`);
      buildScripts.length = 0;
    }

    if (buildScripts.length > 0 && linkType !== LinkType.HARD) {
      this.opts.report.reportWarning(MessageName.SOFT_LINK_BUILD, `${structUtils.prettyLocator(this.opts.project.configuration, locator)} lists build scripts, but is referenced through a soft link. Soft links don't support build scripts, so they'll be ignored.`);
      buildScripts.length = 0;
    }

    const dependenciesMeta = this.opts.project.topLevelWorkspace.manifest.dependenciesMeta;
    const dependencyMeta = dependenciesMeta.get(structUtils.stringifyLocator(locator)) || dependenciesMeta.get(structUtils.stringifyIdent(locator));

    if (buildScripts.length > 0 && dependencyMeta && dependencyMeta.build === false) {
      this.opts.report.reportInfo(MessageName.BUILD_DISABLED, `${structUtils.prettyLocator(this.opts.project.configuration, locator)} lists build scripts, but its build has been explicitly disabled through configuration.`);
      buildScripts.length = 0;
    }

    if (buildScripts.length > 0 || this.isUnplugged(locator))
      packageFs = await this.unplugPackage(locator, packageFs);

    const packageLocation = this.normalizeDirectoryPath(packageFs.getRealPath());
    const packageDependencies = new Map();

    const packageInformationStore = this.getPackageInformationStore(key1);
    packageInformationStore.set(key2, {packageLocation, packageDependencies});

    return {
      packageLocation,
      buildDirective: buildScripts.length > 0 ? {
        scriptNames: buildScripts,
      } : null,
    };
  }

  async attachInternalDependencies(locator: Locator, dependencies: Array<Locator>) {
    const packageInformation = this.getPackageInformation(locator);

    packageInformation.packageDependencies = new Map(dependencies.map(dependency => {
      return [structUtils.requirableIdent(dependency), dependency.reference];
    }) as Array<[string, string]>);
  }

  async attachExternalDependents(locator: Locator, dependentPaths: Array<string>) {
    for (const dependentPath of dependentPaths) {
      const packageInformation = this.getDiskInformation(dependentPath);
      packageInformation.packageDependencies.set(structUtils.requirableIdent(locator), locator.reference);
    }
  }

  async finalizeInstall() {
    this.packageInformationStores.set(null, new Map([
      [null, this.getPackageInformation(this.opts.project.topLevelWorkspace.anchoredLocator)],
    ]));

    const shebang = this.opts.project.configuration.pnpShebang;
    const blacklistedLocations: LocationBlacklist = new Set();
    const replacements: TemplateReplacements = {};
    const packageInformationStores = this.packageInformationStores;

    replacements.IGNORE_PATTERN = JSON.stringify(this.opts.project.configuration.pnpIgnorePattern);
  
    const pnpScript = generatePnpScript({shebang, blacklistedLocations, replacements, packageInformationStores});

    const fs = new NodeFS();
    await fs.changeFilePromise(this.opts.project.configuration.pnpPath, pnpScript);
    await fs.chmodPromise(this.opts.project.configuration.pnpPath, 0o755);
  }

  private getPackageInformationStore(key: string) {
    let packageInformationStore = this.packageInformationStores.get(key);

    if (!packageInformationStore)
      this.packageInformationStores.set(key, packageInformationStore = new Map());

    return packageInformationStore;
  }

  private getPackageInformation(locator: Locator) {
    const key1 = structUtils.requirableIdent(locator);
    const key2 = locator.reference;

    const packageInformationStore = this.packageInformationStores.get(key1);
    if (!packageInformationStore)
      throw new Error(`Assertion failed: The package information store should have been available (for ${structUtils.prettyIdent(this.opts.project.configuration, locator)})`);

    const packageInformation = packageInformationStore.get(key2);
    if (!packageInformation)
      throw new Error(`Assertion failed: The package information should have been available (for ${structUtils.prettyLocator(this.opts.project.configuration, locator)})`);
    
    return packageInformation;
  }

  private getDiskInformation(path: string) {
    const packageInformationStore = this.getPackageInformationStore(`@@disk`);
    const normalizedPath = this.normalizeDirectoryPath(path);

    let diskInformation = packageInformationStore.get(normalizedPath);

    if (!diskInformation) {
      packageInformationStore.set(normalizedPath, diskInformation = {
        packageLocation: normalizedPath,
        packageDependencies: new Map(),
      });
    }

    return diskInformation;
  }

  private normalizeDirectoryPath(folder: string) {
    let relativeFolder = posix.relative(this.opts.project.cwd, folder);

    if (!relativeFolder.match(/^\.{0,2}\//))
      relativeFolder = `./${relativeFolder}`;

    return relativeFolder.replace(/\/?$/, '/');
  }

  private async getBuildScripts(packageFs: FakeFS) {
    const buildScripts = [];
    const {scripts} = await Manifest.find(`.`, {baseFs: packageFs});

    for (const scriptName of [`preinstall`, `install`, `postinstall`])
      if (scripts.has(scriptName))
        buildScripts.push(scriptName);
    
    return buildScripts;
  }

  private getUnpluggedPath(locator: Locator) {
    return posix.resolve(this.opts.project.configuration.pnpUnpluggedFolder, structUtils.slugifyLocator(locator));
  }

  private async unplugPackage(locator: Locator, packageFs: FakeFS) {
    const unplugPath = this.getUnpluggedPath(locator);

    const fs = new NodeFS();
    await fs.mkdirpPromise(unplugPath);
    await fs.copyPromise(unplugPath, `.`, {baseFs: packageFs});

    return new CwdFS(unplugPath);
  }

  private isUnplugged(locator: Locator) {
    return UNPLUGGED_PACKAGES.has(locator.identHash);
  }
}
