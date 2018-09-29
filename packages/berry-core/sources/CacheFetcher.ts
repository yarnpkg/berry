import {Fetcher, FetchOptions} from './Fetcher';
import {Locator}               from './types';

export class CacheFetcher implements Fetcher {
  private readonly next: Fetcher;

  constructor(next: Fetcher) {
    this.next = next;
  }

  supports(locator: Locator) {
    return this.next.supports(locator);
  }

  async fetch(locator: Locator, opts: FetchOptions) {
    const cacheEntry = await opts.cache.fetchFromCache(locator, () => {
      return this.next.fetch(locator, opts);
    });

    return cacheEntry.file;
  }
}
