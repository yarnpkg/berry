import {Fetcher, FetchOptions, MinimalFetchOptions} from './Fetcher';
import {MessageName}                                from './MessageName';
import {ReportError}                                from './Report';
import * as structUtils                             from './structUtils';
import {Locator}                                    from './types';

export class MultiFetcher implements Fetcher {
  type = 'protocol';
  private readonly fetchers: Array<Fetcher>;

  constructor(fetchers: Array<Fetcher>) {
    this.fetchers = fetchers;
  }

  addFetcher(fetcher: Fetcher) {
    this.fetchers.push(fetcher);
  }

  async supports(locator: Locator, opts: MinimalFetchOptions) {
    return !!(await this.tryFetcher(locator, opts));
  }

  async getLocalPath(locator: Locator, opts: FetchOptions) {
    const fetcher = await this.getFetcher(locator, opts);

    return await fetcher.getLocalPath(locator, opts);
  }

  async fetch(locator: Locator, opts: FetchOptions) {
    const fetcher = await this.getFetcher(locator, opts);

    return await fetcher.fetch(locator, opts);
  }

  private async tryFetcher(locator: Locator, opts: MinimalFetchOptions) {
    for (const fetcher of this.fetchers)
      if (fetcher.supports(locator, opts)) return fetcher;
    return null;
  }

  private async getFetcher(locator: Locator, opts: MinimalFetchOptions) {
    for (const fetcher of this.fetchers)
      if (fetcher.supports(locator, opts)) return fetcher;
    throw new ReportError(MessageName.FETCHER_NOT_FOUND, `${structUtils.prettyLocator(opts.project.configuration, locator)} isn't supported by any available fetcher`);
  }
}
