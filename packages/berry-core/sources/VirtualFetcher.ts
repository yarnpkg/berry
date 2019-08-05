import {AliasFS, VirtualFS, ppath}          from '@berry/fslib';

import {Fetcher, FetchOptions, FetchResult} from './Fetcher';
import * as structUtils                     from './structUtils';
import {Locator}                            from './types';

export class VirtualFetcher implements Fetcher {
  supports(locator: Locator) {
    if (!locator.reference.startsWith(`virtual:`))
      return false;

    return true;
  }

  getLocalPath(locator: Locator, opts: FetchOptions) {
    const splitPoint = locator.reference.indexOf(`#`);
    if (splitPoint === -1)
      throw new Error(`Invalid virtual package reference`);

    const nextReference = locator.reference.slice(splitPoint + 1);
    const nextLocator = structUtils.makeLocator(locator, nextReference);

    return opts.fetcher.getLocalPath(nextLocator, opts);
  }

  async fetch(locator: Locator, opts: FetchOptions) {
    const splitPoint = locator.reference.indexOf(`#`);
    if (splitPoint === -1)
      throw new Error(`Invalid virtual package reference`);

    const nextReference = locator.reference.slice(splitPoint + 1);
    const nextLocator = structUtils.makeLocator(locator, nextReference);

    const parentFetch = await opts.fetcher.fetch(nextLocator, opts);

    return await this.ensureVirtualLink(locator, parentFetch, opts);
  }

  getLocatorFilename(locator: Locator) {
    return structUtils.slugifyLocator(locator);
  }

  private async ensureVirtualLink(locator: Locator, sourceFetch: FetchResult, opts: FetchOptions) {
    const to = sourceFetch.packageFs.getRealPath();

    const virtualFolder = opts.project.configuration.get(`virtualFolder`);
    const virtualName = this.getLocatorFilename(locator);
    const virtualPath = VirtualFS.makeVirtualPath(virtualFolder, virtualName, to);

    // We then use an alias to tell anyone that asks us that we're operating within the virtual folder, while still using the same old fs
    const aliasFs = new AliasFS(virtualPath, {baseFs: sourceFetch.packageFs, pathUtils: ppath});

    return {...sourceFetch, packageFs: aliasFs};
  }
}
