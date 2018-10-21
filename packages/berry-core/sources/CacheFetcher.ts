import {Fetcher, FetchOptions, MinimalFetchOptions} from './Fetcher';
import {Manifest}                                   from './Manifest';
import {Locator}                                    from './types';

export class CacheFetcher implements Fetcher {
  private readonly next: Fetcher;

  constructor(next: Fetcher) {
    this.next = next;
  }

  supports(locator: Locator, opts: MinimalFetchOptions) {
    return this.next.supports(locator, opts);
  }

  async fetch(locator: Locator, opts: FetchOptions) {
    return await opts.cache.fetchFromCache(locator, () => {
      return this.next.fetch(locator, opts);
    });
  }
}
