import {Fetcher, FetchOptions} from './Fetcher';
import * as structUtils        from './structUtils';
import {Locator}               from './types';

export class VirtualFetcher implements Fetcher {
  supports(locator: Locator) {
    if (!locator.reference.startsWith(`virtual:`))
      return false;

    return true;
  }

  async fetch(locator: Locator, opts: FetchOptions) {
    const splitPoint = locator.reference.indexOf(`#`);

    if (splitPoint === -1)
      throw new Error(`Invalid virtual package reference`);

    const nextReference = locator.reference.slice(splitPoint + 1);
    const nextLocator = structUtils.makeLocator(locator, nextReference);

    const parentFs = await opts.fetcher.fetch(nextLocator, opts);
    
    return await opts.cache.ensureVirtualLink(locator, parentFs);
  }
}
