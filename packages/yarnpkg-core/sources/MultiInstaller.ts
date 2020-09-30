import {PortablePath}                              from '@yarnpkg/fslib';

import {FetchResult}                               from './Fetcher';
import {Installer, InstallStatus}                  from './Installer';
import {FinalizeInstallStatus}                     from './Installer';
import {Package, Locator, Descriptor, LocatorHash} from './types';

export class MultiInstaller implements Installer {
  private readonly packageInstallers: Map<LocatorHash, Set<Installer>>;
  private readonly allInstallers: Set<Installer> = new Set();

  constructor(packageInstallers: Map<LocatorHash, Set<Installer>>) {
    this.packageInstallers = packageInstallers;
    for (const installers of this.packageInstallers.values()) {
      for (const installer of installers) {
        this.allInstallers.add(installer);
      }
    }
  }

  async installPackage(pkg: Package, fetchResult: FetchResult): Promise<Array<InstallStatus>> {
    const statuses: Array<InstallStatus> = [];
    const installers = this.packageInstallers.get(pkg.locatorHash);
    if (!installers)
      throw new Error(`Assertion failed. The installers for the package should have been registered.`);

    for (const installer of installers) {
      const result = await installer.installPackage(pkg, fetchResult);
      if (Array.isArray(result)) {
        statuses.push(...result);
      } else {
        statuses.push(result);
      }
    }

    return statuses;
  }

  async attachInternalDependencies(locator: Locator, dependencies: Array<[Descriptor, Locator]>): Promise<void> {
    const installers = this.packageInstallers.get(locator.locatorHash);
    if (!installers)
      throw new Error(`Assertion failed. The installers for the package should have been registered.`);

    for (const installer of installers) {
      installer.attachInternalDependencies(locator, dependencies);
    }
  }

  async attachExternalDependents(locator: Locator, dependentPaths: Array<PortablePath>): Promise<void> {
    const installers = this.packageInstallers.get(locator.locatorHash);
    if (!installers)
      throw new Error(`Assertion failed. The installers for the package should have been registered.`);

    for (const installer of installers) {
      installer.attachExternalDependents(locator, dependentPaths);
    }
  }

  async finalizeInstall(): Promise<Array<FinalizeInstallStatus>> {
    const cummulativeResult: Array<FinalizeInstallStatus> = [];

    for (const installer of this.allInstallers) {
      const result = await installer.finalizeInstall();
      if (Array.isArray(result)) {
        cummulativeResult.push(...result);
      }
    }

    return cummulativeResult;
  }
}
