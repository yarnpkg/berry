import {Linker, LinkOptions, MinimalLinkOptions, Manifest, MessageName, DependencyMeta} from '@yarnpkg/core';
import {FetchResult, Ident, Locator, Package, BuildDirective, BuildType}                from '@yarnpkg/core';
import {miscUtils, structUtils}                                                         from '@yarnpkg/core';
import {CwdFS, FakeFS, PortablePath, npath, ppath, toFilename, xfs}                     from '@yarnpkg/fslib';
import {generateInlinedScript, generateSplitScript, PnpSettings}                        from '@yarnpkg/pnp';
import {UsageError}                                                                     from 'clipanion';

import {AbstractPnpInstaller}                                                           from './AbstractPnpInstaller';
import {getPnpPath}                                                                     from './index';

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
      throw new UsageError(`The project in ${opts.project.cwd}/package.json doesn't seem to have been installed - running an install there might help`);

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

export class PnpInstaller extends AbstractPnpInstaller {
  protected mode = `strict`;

  private readonly unpluggedPaths: Set<string> = new Set();

  async getBuildScripts(locator: Locator, manifest: Manifest | null, fetchResult: FetchResult): Promise<Array<BuildDirective>> {
    if (manifest === null)
      return [];

    const buildScripts: Array<BuildDirective> = [];

    for (const scriptName of [`preinstall`, `install`, `postinstall`])
      if (manifest.scripts.has(scriptName))
        buildScripts.push([BuildType.SCRIPT, scriptName]);

    // Detect cases where a package has a binding.gyp but no install script
    const bindingFilePath = ppath.join(fetchResult.prefixPath, toFilename(`binding.gyp`));
    if (!manifest.scripts.has(`install`) && fetchResult.packageFs.existsSync(bindingFilePath))
      buildScripts.push([BuildType.SHELLCODE, `node-gyp rebuild`]);

    return buildScripts;
  }

  async transformPackage(locator: Locator, manifest: Manifest | null, fetchResult: FetchResult, dependencyMeta: DependencyMeta, {hasBuildScripts}: {hasBuildScripts: boolean}) {
    if (this.isUnplugged(locator, manifest, fetchResult, dependencyMeta, {hasBuildScripts})) {
      return this.unplugPackage(locator, fetchResult.packageFs);
    } else {
      return fetchResult.packageFs;
    }
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

    const nodeModules = await this.locateNodeModules();
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

  private async locateNodeModules() {
    const nodeModules: Array<PortablePath> = [];

    for (const workspace of this.opts.project.workspaces) {
      const nodeModulesPath = ppath.join(workspace.cwd, toFilename(`node_modules`));
      if (!xfs.existsSync(nodeModulesPath))
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

  private isUnplugged(ident: Ident, manifest: Manifest | null, fetchResult: FetchResult, dependencyMeta: DependencyMeta, {hasBuildScripts}: {hasBuildScripts: boolean}) {
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
}
