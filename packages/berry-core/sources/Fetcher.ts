import {FakeFS, PortablePath} from '@berry/fslib';

import {Cache}                from './Cache';
import {Project}              from './Project';
import {Report}               from './Report';
import {LocatorHash, Locator} from './types';

export type MinimalFetchOptions = {
  project: Project,
  fetcher: Fetcher,
};

export type FetchOptions = MinimalFetchOptions & {
  cache: Cache,
  checksums: Map<LocatorHash, string>,
  report: Report,
};

export type FetchResult = {
  packageFs: FakeFS<PortablePath>,
  releaseFs?: () => void,
  prefixPath: PortablePath,
  localPath?: PortablePath | null
  checksum?: string,
};

/**
 * Fetchers are the component tasked from taking a locator and fetching its
 * file data from whatever location the fetcher deems right. For example, the
 * npm fetcher would download them from the npm registry while the workspace
 * fetcher would simply return an plain link to the filesystem.
 */

export interface Fetcher {
  /**
   * This function must return true if the specified locator is understood by
   * this resolver (only its syntax is checked, it doesn't have to be valid
   * and it's fine if the `fetch` ends up returning a 404).
   *
   * @param locator The locator that needs to be validated.
   * @param opts The fetch options.
   */
  supports(locator: Locator, opts: MinimalFetchOptions): boolean;

  /**
   * This function must return the local path for the given package. The local
   * path is the one that's used to resolve relative dependency sources, for
   * example "file:./foo".
   *
   * @param locator The source locator.
   * @param opts The fetch options.
   */
  getLocalPath(locator: Locator, opts: FetchOptions): PortablePath | null;

  /**
   * This function must return a object describing where the package manager
   * can find the data for the specified package on disk.
   *
   * The return value is a more complex than a regular path (cf FetchResult)
   * because the fetchers are allowed to return virtual paths that point to
   * things that don't actually exist (for example directories stored within
   * zip archives).
   *
   * @param locator The source locator.
   * @param opts The fetch options.
   */
  fetch(locator: Locator, opts: FetchOptions): Promise<FetchResult>;
}
