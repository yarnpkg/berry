import {BuildDirective, BuildType, Configuration, Descriptor, FetchResult, Installer}     from '@yarnpkg/core';
import {LinkOptions, Linker, LinkType, Locator, MinimalLinkOptions, Package, structUtils} from '@yarnpkg/core';
import {CwdFS, Filename, PortablePath, ppath, xfs}                                        from '@yarnpkg/fslib';
import {UsageError}                                                                       from 'clipanion';

function getUnpluggedPath(locator: Locator, {configuration}: {configuration: Configuration}) {
  return ppath.resolve(configuration.get(`cmakeUnpluggedFolder`), structUtils.slugifyLocator(locator));
}

export class CMakeLinker implements Linker {
  supportsPackage(pkg: Package, opts: MinimalLinkOptions) {
    return pkg.languageName === `cmake`;
  }

  async findPackageLocation(locator: Locator, opts: LinkOptions) {
    const unplugPath = getUnpluggedPath(locator, {configuration: opts.project.configuration});
    if (!xfs.existsSync(unplugPath))
      throw new UsageError(`Couldn't find ${structUtils.prettyLocator(opts.project.configuration, locator)} in the project - running an install might help`);

    const {prefixPath} = await xfs.readJsonPromise(ppath.join(unplugPath, `.yarn-install.json` as Filename));
    return ppath.join(unplugPath, prefixPath);
  }

  async findPackageLocator(location: PortablePath, opts: LinkOptions) {
    let current = location;

    do {
      const candidate = ppath.join(current, `.yarn-install.json` as Filename);
      if (xfs.existsSync(candidate)) {
        const {locator} = await xfs.readJsonPromise(candidate);
        return structUtils.parseLocator(locator);
      } else {
        current = ppath.dirname(current);
      }
    } while (current !== `/`);

    return null;
  }

  makeInstaller(opts: LinkOptions) {
    return new CMakeInstaller(opts);
  }
}

class CMakeInstaller implements Installer {
  private readonly unpluggedPaths: Set<string> = new Set();

  private readonly opts: LinkOptions;

  constructor(opts: LinkOptions) {
    this.opts = opts;
  }

  async installPackage(pkg: Package, fetchResult: FetchResult) {
    if (pkg.linkType === LinkType.SOFT)
      throw new Error(`This package cannot be referenced through a soft link, as it needs to be compiled`);

    const packageFs = await this.unplugPackage(pkg, fetchResult);
    const packageRawLocation = ppath.resolve(packageFs.getRealPath(), ppath.relative(PortablePath.root, fetchResult.prefixPath));

    const buildDirective: Array<BuildDirective> = [];
    buildDirective.push([BuildType.SHELLCODE, `mkdir build && cd build && cmake ..`]);

    return {
      packageLocation: packageRawLocation,
      buildDirective,
    };
  }

  async attachInternalDependencies(locator: Locator, dependencies: Array<[Descriptor, Locator]>) {
  }

  async attachExternalDependents(locator: Locator, dependentPaths: Array<PortablePath>) {
  }

  async finalizeInstall() {
    const pnpUnpluggedFolder = this.opts.project.configuration.get(`cmakeUnpluggedFolder`);
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

  private async unplugPackage(locator: Locator, {packageFs, prefixPath}: FetchResult) {
    const unplugPath = getUnpluggedPath(locator, {configuration: this.opts.project.configuration});
    this.unpluggedPaths.add(unplugPath);

    await xfs.mkdirpPromise(unplugPath);
    await xfs.copyPromise(unplugPath, PortablePath.dot, {baseFs: packageFs, overwrite: false});

    await xfs.writeJsonPromise(ppath.join(unplugPath, `.yarn-install.json` as Filename), {
      locator: structUtils.stringifyLocator(locator),
      prefixPath,
    });

    return new CwdFS(unplugPath);
  }
}
