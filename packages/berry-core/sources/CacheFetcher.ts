import {Fetcher, FetchOptions, MinimalFetchOptions} from './Fetcher';
import {Manifest}                                   from './Manifest';
import {MessageName}                                from './Report';
import * as structUtils                             from './structUtils';
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
    if (opts.readOnly)
      return await opts.cache.fetchFromCache(locator);

    return await opts.cache.fetchFromCache(locator, () => {
      opts.report.reportInfoOnce(MessageName.FETCH_NOT_CACHED, `${structUtils.prettyLocator(opts.project.configuration, locator)} can't be found in the cache and will be fetched from its remote location`);
      return this.next.fetch(locator, opts);
    });
  }
}
