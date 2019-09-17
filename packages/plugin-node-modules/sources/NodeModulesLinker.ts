import {Installer, Linker, LinkOptions, MinimalLinkOptions} from '@yarnpkg/core';
import {FetchResult, Descriptor, Locator, Package}          from '@yarnpkg/core';
import {PortablePath}                                       from '@yarnpkg/fslib';

export class NodeModulesLinker implements Linker {
  supportsPackage(pkg: Package, opts: MinimalLinkOptions) {
    return true;
  }

  async findPackageLocation(locator: Locator, opts: LinkOptions) {
    return null;
  }

  async findPackageLocator(location: PortablePath, opts: LinkOptions) {
    return null;
  }

  makeInstaller(opts: LinkOptions) {
    return new NodeModulesInstaller(opts);
  }
}

class NodeModulesInstaller implements Installer {
  private readonly opts: LinkOptions;

  constructor(opts: LinkOptions) {
    this.opts = opts;
  }

  async installPackage(pkg: Package, fetchResult: FetchResult) {
    return null;
  }

  async attachInternalDependencies(locator: Locator, dependencies: Array<[Descriptor, Locator]>) {
    return null;
  }

  async attachExternalDependents(locator: Locator, dependentPaths: Array<PortablePath>) {
    return null;
  }

  async finalizeInstall() {
  }
}
