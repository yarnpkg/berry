import {FakeFS}   from '@berry/zipfs';

import {Cache}    from './Cache';
import {Project}  from './Project';
import {Locator}  from './types';

export type MinimalFetchOptions = {
  project: Project,
  fetcher: Fetcher,
};

export type FetchOptions = MinimalFetchOptions & {
  cache: Cache,
};

export interface Fetcher {
  supports(locator: Locator, opts: MinimalFetchOptions): boolean;

  fetch(locator: Locator, opts: FetchOptions): Promise<FakeFS>;
}
