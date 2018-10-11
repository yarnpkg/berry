import {Archive}  from './Archive';
import {Cache}    from './Cache';
import {Manifest} from './Manifest';
import {Project}  from './Project';
import {Locator}  from './types';

export type FetchOptions = {
  cache: Cache,
  fetcher: Fetcher,
  project: Project,
};

export interface Fetcher {
  supports(locator: Locator): boolean;

  fetchManifest(locator: Locator, opts: FetchOptions): Promise<Manifest>;

  fetch(locator: Locator, opts: FetchOptions): Promise<any>;
}
