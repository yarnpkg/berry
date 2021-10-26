import {PortablePath}                              from '@yarnpkg/fslib';

import {FetchResult}                               from './Fetcher';
import {Descriptor, Locator, Package, LocatorHash} from './types';

export enum BuildType {
  SCRIPT = 0,
  SHELLCODE = 1,
}

export type BuildDirective = [BuildType, string];

export type InstallStatus = {
  packageLocation: PortablePath | null;
  buildDirective: Array<BuildDirective> | null;
  installPromise?: Promise<void>;
};

export type FinalizeInstallStatus = {
  locatorHash: LocatorHash;
  buildLocations: Array<PortablePath>;
  buildDirective: Array<BuildDirective>;
};

export type FinalizeInstallData = {
  /**
   * A list of extra package instances that may have been installed on the
   * disk. While we usually recommend to avoid this feature (one package should
   * only be installed once in a project, virtual dependencies excluded), it
   * may be required to duplicate installs in some cases - for instance to
   * replicate the hoisting that would happen with the node-modules linking
   * strategy.
   */
  records?: Array<FinalizeInstallStatus>;

  /**
   * A set of data that are preserved from one install to the next. Linkers are
   * allowed to cache whatever they want (including ES-native data structures
   * like Map and Set) as long as they remember to follow basic rules:
   *
   * - They have to be prepared for no custom data to be passed at all; Yarn
   *   is allowed to clear the cache at will.
   *
   * - They have to cache only things that are unlikely to change. For instance
   *   caching the packages' `scripts` field is fine, but caching their
   *   dependencies isn't (first because dependencies are provided by the core
   *   itself, so caching wouldn't make sense, but also because users may
   *   change the dependencies of any package via the `resolutions` field).
   *
   * And of course, they have to manage their own migration.
   */
  customData?: any;
};

export type InstallPackageExtraApi = {
  /**
   * The core reclaims the virtual filesystem by default when the
   * `installPackage` function returns. This may be annoying when working on
   * parallel installers, since `installPackage` are guaranteed to work
   * sequentially (and thus no two packages could be installed at the same
   * time, since one's fs would be closed as soon as the second would start).
   *
   * To avoid that, you can call the `holdFetchResult` function from this extra
   * API to indicate to the core that it shouldn't reclaim the filesystem until
   * the API passed in parameter as finished executing. Note that this may lead
   * to higher memory consumption (since multiple packages may be kept in
   * memory), so you'll need to implement an upper bound to the number of
   * concurrent package installs.
   */
  holdFetchResult: (promise: Promise<void>) => void;
};

export interface Installer {
  /**
   * Return an arbitrary key.
   *
   * This key will be used to save and restore the installer's custom data. You
   * typically will want to return the installer's name, but you can be fancy
   * and send a stringified JSON payload that include the cache version, etc.
   *
   * TODO (Yarn 4): Move this method into `Linker` so that linkers can use it
   * to save some state useful to findPackageLocator (cf PnpmLinker).
   */
  getCustomDataKey(): string;

  /**
   * Only called if the installer has a custom data key matching one currently
   * stored. Will be called with whatever `finalizeInstall` returned in its
   * `customData` field.
   */
  attachCustomData(customData: unknown): void;

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
   * @param pkg The package being installed
   * @param fetchResult The fetched information about the package
   * @param api An additional API one can use to interact with the core
   */
  installPackage(pkg: Package, fetchResult: FetchResult, api: InstallPackageExtraApi): Promise<InstallStatus>;

  /**
   * Link a package and its internal (same-linker) dependencies.
   *
   * This function is guaranteed to be called for all packages before the
   * install is finalized.
   *
   * @param locator The package itself
   * @param dependencies The package dependencies
   */
  attachInternalDependencies(locator: Locator, dependencies: Array<[Descriptor, Locator]>): Promise<void>;

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
  attachExternalDependents(locator: Locator, dependentPaths: Array<PortablePath>): Promise<void>;

  /**
   * Finalize the install by writing miscellaneous files to the disk.
   */
  finalizeInstall(): Promise<FinalizeInstallData | void | undefined>;
}
