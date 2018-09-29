import {Archive} from './Archive';
import {Cache}   from './Cache';
import {Project} from './Project';
import {Locator} from './types';

export type FetchOptions = {
  cache: Cache,
  project: Project,
  root: Fetcher,
};

export interface Fetcher {
  supports(locator: Locator): boolean;

  fetch(locator: Locator, opts: FetchOptions): Promise<any>;
}
