import {Installer}        from './Installer';
import {Project}          from './Project';
import {Report}           from './Report';
import {Locator, Package} from './types';

export type MinimalLinkOptions = {
  project: Project,
};

export type LinkOptions = MinimalLinkOptions & {
  report: Report,
};

export interface Linker {
  supports(pkg: Package, opts: MinimalLinkOptions): boolean;

  /**
   * Find a package on the disk, based on the current install state.
   * 
   * @param locator The package being searched
   * @param opts The linker options
   */
  findPackage(locator: Locator, opts: LinkOptions): Promise<string>;

  /**
   * Make a installer object that describes how to install the packages on the
   * disk.
   * 
   * @param opts The linker options
   */
  makeInstaller(opts: LinkOptions): Installer;
}
