import {AliasFS}                            from '@berry/zipfs';
import {mkdirp}                             from 'fs-extra';
import {readlink, symlink}                  from 'fs';
import {dirname, relative, resolve}         from 'path';
import {promisify}                          from 'util';

import {Fetcher, FetchOptions, FetchResult} from './Fetcher';
import * as structUtils                     from './structUtils';
import {Locator}                            from './types';

const readlinkP = promisify(readlink);
const symlinkP = promisify(symlink);

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

  private async ensureVirtualLink(locator: Locator, sourceFetch: FetchResult, opts: FetchOptions) {
    const virtualLink = resolve(opts.project.configuration.virtualFolder, opts.cache.getCacheKey(locator));
    const relativeTarget = relative(dirname(virtualLink), sourceFetch.packageFs.getRealPath());

    let currentLink;
    try {
      currentLink = await readlinkP(virtualLink);
    } catch (error) {
      if (error.code !== `ENOENT`) {
        throw error;
      }
    }

    if (currentLink !== undefined && currentLink !== relativeTarget)
      throw new Error(`Conflicting virtual paths (current ${currentLink} != new ${relativeTarget})`);

    if (currentLink === undefined) {
      await mkdirp(dirname(virtualLink));
      await symlinkP(relativeTarget, virtualLink);
    }

    return {
      ... sourceFetch,
      packageFs: new AliasFS(virtualLink, {baseFs: sourceFetch.packageFs})
    };
  }
}
