import {FakeFS}  from '@berry/zipfs';

import {Cache}   from './Cache';
import {Project} from './Project';
import {Report}  from './Report';
import {Locator} from './types';

export type MinimalFetchOptions = {
  project: Project,
  fetcher: Fetcher,
};

export type FetchOptions = MinimalFetchOptions & {
  cache: Cache,
  readOnly: boolean,
  report: Report,
};

// The returned function is the cleanup function that frees the resources that
// may have been allocated by the fetcher (such as closing file descriptors)
export type FetchResult = [FakeFS, () => Promise<void>];

export interface Fetcher {
  supports(locator: Locator, opts: MinimalFetchOptions): boolean;

  fetch(locator: Locator, opts: FetchOptions): Promise<FetchResult>;
}
