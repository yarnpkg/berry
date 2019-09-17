import {Installer, Linker, LinkOptions, MinimalLinkOptions}       from '@yarnpkg/core';
import {FetchResult, Descriptor, Locator, Package, InstallStatus} from '@yarnpkg/core';
import {PortablePath}                                             from '@yarnpkg/fslib';

export class NodeModulesLinker implements Linker {
  supportsPackage(pkg: Package, opts: MinimalLinkOptions): boolean {
    return true;
  }

  async findPackageLocation(locator: Locator, opts: LinkOptions): Promise<PortablePath> {
    return PortablePath.root;
  }

  async findPackageLocator(location: PortablePath, opts: LinkOptions): Promise<Locator | null> {
    return null;
  }

  makeInstaller(opts: LinkOptions): Installer {
    return new NodeModulesInstaller(opts);
  }
}

class NodeModulesInstaller implements Installer {
  private readonly opts: LinkOptions;

  constructor(opts: LinkOptions) {
    this.opts = opts;
  }

  async installPackage(pkg: Package, fetchResult: FetchResult): Promise<InstallStatus> {
    return {packageLocation: PortablePath.root};
  }

  async attachInternalDependencies(locator: Locator, dependencies: Array<[Descriptor, Locator]>): Promise<void> {
  }

  async attachExternalDependents(locator: Locator, dependentPaths: Array<PortablePath>): Promise<void> {
  }

  async finalizeInstall(): Promise<void> {
  }
}
