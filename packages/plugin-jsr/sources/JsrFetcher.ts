import {Fetcher, FetchOptions, Locator} from '@yarnpkg/core';

import {JSR_PROTOCOL}                   from './constants';
import {convertLocatorFromJsrToNpm}     from './helpers';

export class JsrFetcher implements Fetcher {
  supports(locator: Locator, opts: FetchOptions) {
    return locator.reference.startsWith(JSR_PROTOCOL);
  }

  getLocalPath(locator: Locator, opts: FetchOptions) {
    const nextLocator = convertLocatorFromJsrToNpm(locator);

    return opts.fetcher.getLocalPath(nextLocator, opts);
  }

  fetch(locator: Locator, opts: FetchOptions) {
    const nextLocator = convertLocatorFromJsrToNpm(locator);

    return opts.fetcher.fetch(nextLocator, opts);
  }
}
