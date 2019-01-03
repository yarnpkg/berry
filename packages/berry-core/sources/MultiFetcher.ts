import {Fetcher, FetchOptions, MinimalFetchOptions} from './Fetcher';
import * as structUtils                             from './structUtils';
import {Locator}                                    from './types';

export class MultiFetcher implements Fetcher {
  private readonly fetchers: Array<Fetcher>;

  constructor(fetchers: Array<Fetcher>) {
    this.fetchers = fetchers;
  }

  supports(locator: Locator, opts: MinimalFetchOptions) {
    if (!this.tryFetcher(locator, opts))
      return false;

    return true;
  }

  async fetch(locator: Locator, opts: FetchOptions) {
    const fetcher = this.getFetcher(locator, opts);

    return await fetcher.fetch(locator, opts);
  }

  private tryFetcher(locator: Locator, opts: MinimalFetchOptions) {
    const fetcher = this.fetchers.find(fetcher => fetcher.supports(locator, opts));

    if (!fetcher)
      return null;

    return fetcher;
  }

  private getFetcher(locator: Locator, opts: MinimalFetchOptions) {
    const fetcher = this.fetchers.find(fetcher => fetcher.supports(locator, opts));

    if (!fetcher)
      throw new Error(`Couldn't find a fetcher for ${structUtils.prettyLocator(opts.project.configuration, locator)}`);

    return fetcher;
  }
}
