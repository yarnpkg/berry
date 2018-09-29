import {Fetcher, FetchOptions} from './Fetcher';
import * as structUtils        from './structUtils';
import {Locator}               from './types';

export class MultiFetcher implements Fetcher {
  private readonly fetchers: Array<Fetcher>;

  constructor(fetchers: Array<Fetcher>) {
    this.fetchers = fetchers;
  }

  tryFetcher(locator: Locator) {
    const fetcher = this.fetchers.find(fetcher => fetcher.supports(locator));

    if (!fetcher)
      return null;

    return fetcher;
  }

  getFetcher(locator: Locator) {
    const fetcher = this.fetchers.find(fetcher => fetcher.supports(locator));

    if (!fetcher)
      throw new Error(`Couldn't find a fetcher for '${structUtils.prettyLocator(locator)}'`);

    return fetcher;
  }

  supports(locator: Locator) {
    if (!this.tryFetcher(locator))
      return false;

    return true;
  }

  async fetch(locator: Locator, opts: FetchOptions) {
    const fetcher = this.getFetcher(locator);

    return await fetcher.fetch(locator, opts);
  }
}
