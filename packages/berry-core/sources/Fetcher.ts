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

export type FetchResult = {
  packageFs: FakeFS,
  prefixPath: string,
  localPath?: string | null,
};

export interface Fetcher {
  supports(locator: Locator, opts: MinimalFetchOptions): boolean;

  fetch(locator: Locator, opts: FetchOptions): Promise<FetchResult>;
}
