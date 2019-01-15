import {Fetcher, FetchOptions, MinimalFetchOptions} from '@berry/core';
import {Locator, MessageName}                       from '@berry/core';
import {structUtils, tgzUtils}                      from '@berry/core';
import {NodeFS}                                     from '@berry/zipfs';
import {posix}                                      from 'path';
import querystring                                  from 'querystring';

import {TARBALL_REGEXP, PROTOCOL}                   from './constants';

export class TarballFileFetcher implements Fetcher {
  static mountPoint: string = `cached-fetchers`;

  supports(locator: Locator, opts: MinimalFetchOptions) {
    if (!TARBALL_REGEXP.test(locator.reference))
      return false;

    if (locator.reference.startsWith(PROTOCOL))
      return true;

    return false;
  }

  async fetch(locator: Locator, opts: FetchOptions) {
    const packageFs = await opts.cache.fetchFromCache(locator, async () => {
      opts.report.reportInfoOnce(MessageName.FETCH_NOT_CACHED, `${structUtils.prettyLocator(opts.project.configuration, locator)} can't be found in the cache and will be fetched from the disk`);
      return await this.fetchFromDisk(locator, opts);
    });

    return {packageFs, prefixPath: `/`};
  }

  async fetchFromDisk(locator: Locator, opts: FetchOptions) {
    const {parentLocator, filePath} = this.parseLocator(locator);

    const parentFetch = posix.isAbsolute(filePath)
      ? {packageFs: new NodeFS(), prefixPath: `/`, localPath: `/`}
      : await opts.fetcher.fetch(parentLocator, opts);

    const effectiveParentFetch = parentFetch.localPath
      ? {packageFs: new NodeFS(), prefixPath: parentFetch.localPath}
      : parentFetch;

    const sourceFs = effectiveParentFetch.packageFs;
    const sourcePath = posix.resolve(effectiveParentFetch.prefixPath, filePath);
    const sourceBuffer = await sourceFs.readFilePromise(sourcePath);

    return await tgzUtils.makeArchive(sourceBuffer, {
      stripComponents: 1,
    });
  }

  private parseLocator(locator: Locator) {
    const qsIndex = locator.reference.indexOf(`?`);

    if (qsIndex === -1)
      throw new Error(`Invalid file-type locator`);

    const filePath = locator.reference.slice(PROTOCOL.length, qsIndex);
    const queryString = querystring.parse(locator.reference.slice(qsIndex + 1));

    if (typeof queryString.locator !== `string`)
      throw new Error(`Invalid file-type locator`);

    const parentLocator = structUtils.parseLocator(queryString.locator, true);

    return {parentLocator, filePath};
  }
}
