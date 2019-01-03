import {FakeFS}                         from '@berry/zipfs';

import {LinkType, LocatorHash, Locator} from './types';

export type BuildDirective = {
  disabledReason?: string;
  scriptNames: Array<string>;
};

export type InstallStatus = {
  packageLocation: string,
  buildDirective?: BuildDirective | null,
};

export interface Installer {
  /**
   * Install a package on the disk.
   * 
   * Should return `null` if the package has no install steps, or an object
   * describing the various scripts that need to be run otherwise.
   * 
   * Note that this function isn't called in any specific order. In particular,
   * this means that the order in which this function is called will not
   * necessarily match the order in which the packages will be built.
   * 
   * This function is guaranteed to be called for all packages before the
   * dependencies start to be attached.
   * 
   * @param locator The package being installed
   * @param linkType Whether it's a soft install or hard install
   * @param packageFs A virtual filesystem containing the package sources
   */
  installPackage(locator: Locator, linkType: LinkType, packageFs: FakeFS): Promise<InstallStatus>;

  /**
   * Link a package and its internal (same-linker) dependencies.
   * 
   * This function is guaranteed to be called for all packages before the
   * install is finalized.
   * 
   * @param locator The package itself
   * @param dependencies The package dependencies
   */
  attachInternalDependencies(locator: Locator, dependencies: Array<Locator>): Promise<void>;

  /**
   * Link a package to the location of the external packages that depend on
   * it (only the location is available, since two linkers should be generic
   * enough to not have to make custom integrations).
   * 
   * Will never be called for packages supported by the same linker (they'll
   * be linked through the `attachInternalDependencies` hook instead).
   * 
   * This function is guaranteed to be called for all packages before the
   * install is finalized.
   * 
   * @param locator 
   * @param locations 
   */
  attachExternalDependents(locator: Locator, dependentPaths: Array<string>): Promise<void>;

  /**
   * Finalize the install by writing miscellaneous files to the disk.
   */
  finalizeInstall(): Promise<void>;
};
