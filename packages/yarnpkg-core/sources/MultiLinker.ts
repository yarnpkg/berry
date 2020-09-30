import {PortablePath}                            from '@yarnpkg/fslib';

import {Installer}                               from './Installer';
import {Linker, MinimalLinkOptions, LinkOptions} from './Linker';
import {MultiInstaller}                          from './MultiInstaller';
import {getSetWithDefault}                       from './miscUtils';
import {Package, LocatorHash, Locator}           from './types';

export class MultiLinker implements Linker {
  private readonly linkers: Array<Linker>;
  private readonly packageLinkers: Map<LocatorHash, Set<Linker>> = new Map();

  constructor(linkers: Array<Linker>) {
    this.linkers = linkers;
  }

  supportsPackage(pkg: Package, opts: MinimalLinkOptions): boolean {
    let isPackageSupported = false;

    for (const linker of this.linkers) {
      if (linker.supportsPackage(pkg, opts)) {
        const linkers = getSetWithDefault(this.packageLinkers, pkg.locatorHash);
        linkers.add(linker);
        isPackageSupported = true;
      }
    }

    return isPackageSupported;
  }

  async findPackageLocation(locator: Locator, opts: LinkOptions): Promise<PortablePath | Array<PortablePath>> {
    const paths: Array<PortablePath> = [];
    for (const linker of this.packageLinkers.get(locator.locatorHash) || []) {
      const locations = await linker.findPackageLocation(locator, opts);
      if (locations) {
        if (Array.isArray(locations)) {
          paths.push(...locations);
        } else {
          paths.push(locations);
        }
      }
    }
    return paths;
  }

  async findPackageLocator(location: PortablePath, opts: LinkOptions): Promise<Locator | null> {
    let locator = null;
    for (const linker of this.linkers) {
      locator = await linker.findPackageLocator(location, opts);
      if (locator) {
        break;
      }
    }
    return locator;
  }

  makeInstaller(opts: LinkOptions): Installer {
    const linkerInstallerMap = new Map();
    for (const linker of this.linkers) {
      const installer = linker.makeInstaller(opts);
      linkerInstallerMap.set(linker, installer);
    }

    const packageInstallers = new Map();
    for (const [locatorHash, linkers] of this.packageLinkers) {
      const installers = new Set();
      for (const linker of linkers)
        installers.add(linkerInstallerMap.get(linker));

      packageInstallers.set(locatorHash, installers);
    }

    return new MultiInstaller(packageInstallers);
  }
}
