import {Archive} from './Archive';
import {Locator} from './types';

export interface Fetcher {
  supports(locator: Locator): boolean;

  fetch(locator: Locator): Promise<Archive>;
}
