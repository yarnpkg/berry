import {PortablePath}     from '@yarnpkg/fslib';

import {Installer}        from './Installer';
import {Project}          from './Project';
import {Report}           from './Report';
import {Locator, Package} from './types';

export type MinimalLinkOptions = {
  project: Project;
};

export type LinkOptions = MinimalLinkOptions & {
  report: Report;
};

/**
 * Linkers are the glue between the logical dependency tree and the way it's
 * represented on the filesystem. Their main use is to take the package data
 * and put them on the filesystem in a way that their target environment will
 * understand (for example, in Node's case, it will be to generate a .pnp.cjs
 * file).
 *
 * Note that *multiple linkers can coexist in the same dependency tree*. This
 * makes it possible to have a unique dependency tree containing packages from
 * different linkers.
 */

export interface Linker {
  /**
   * This function must return true if the specified package is understood by
   * this linker. Given that this function takes a package definition as
   * parameter (not only a locator), it's safe to use the languageName field
   * as detection method.
   *
   * @param locator The locator that needs to be validated.
   * @param opts The link options.
   */
  supportsPackage(pkg: Package, opts: MinimalLinkOptions): boolean;

  /**
   * This function must, given a specified locator, find the location where it
   * has been installed.
   *
   * Note that contrary to fetchers (that are allowed to return relatively
   * complex type of data source thanks to their filesystem abstractions), this
   * function is only allowed to return a path. That being said, the way this
   * path is interpreted is open to the package manager, though - in practice
   * it will be used on a ZipOpenFS, so you can return paths from within zip
   * archives.
   *
   * @param locator The queried package.
   * @param opts The link options.
   */
  findPackageLocation(locator: Locator, opts: LinkOptions): Promise<PortablePath>;

  /**
   * This function must, given a specified location on the disk, find the
   * locator for the package that owns it. This function is allowed to fail if
   * the location doesn't seem to be owned by any package covered by the
   * current linker, in which case it should return null.
   *
   * The main case where this function is called is when a postinstall script
   * for a third-party package calls another script of its. In this situation,
   * we must figure out who's making the "run" call, and we can't really rely
   * on anything else than the location on the disk to do so.
   *
   * @param location The queried location on the disk.
   * @param opts The link options.
   */
  findPackageLocator(location: PortablePath, opts: LinkOptions): Promise<Locator | null>;

  /**
   * This function must instantiate an Installer object that describes how to
   * install the packages on the disk. Check the Installer file for more
   * details on the installer design.
   *
   * @param opts The link options.
   */
  makeInstaller(opts: LinkOptions): Installer;
}
