import {Fetcher, FetchOptions, MinimalFetchOptions} from '@berry/core';
import {Locator, MessageName}                       from '@berry/core';
import {structUtils, tgzUtils}                      from '@berry/core';
import {NodeFS}                                     from '@berry/zipfs';
import {posix}                                      from 'path';
import querystring                                  from 'querystring';

import {PROTOCOL}                                   from './constants';

export class FileFetcher implements Fetcher {
  supports(locator: Locator, opts: MinimalFetchOptions) {
    if (!locator.reference.startsWith(PROTOCOL))
      return false;

    return true;
  }

  async fetch(locator: Locator, opts: FetchOptions) {
    const expectedChecksum = opts.checksums.get(locator.locatorHash) || null;

    const [packageFs, checksum] = await opts.cache.fetchPackageFromCache(
      locator,
      expectedChecksum,
      async () => {
        opts.report.reportInfoOnce(MessageName.FETCH_NOT_CACHED, `${structUtils.prettyLocator(opts.project.configuration, locator)} can't be found in the cache and will be fetched from the disk`);
        return await this.fetchFromDisk(locator, opts);
      },
    );

    return {packageFs, prefixPath: `/`, checksum};
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

    return await tgzUtils.makeArchiveFromDirectory(sourcePath, {
      baseFs: sourceFs,
    });
  }

  private parseLocator(locator: Locator) {
    const qsIndex = locator.reference.indexOf(`?`);

    if (qsIndex === -1)
      throw new Error(`Invalid file-type locator`);

    const filePath = posix.normalize(locator.reference.slice(PROTOCOL.length, qsIndex));
    const queryString = querystring.parse(locator.reference.slice(qsIndex + 1));

    if (typeof queryString.locator !== `string`)
      throw new Error(`Invalid file-type locator`);

    const parentLocator = structUtils.parseLocator(queryString.locator, true);

    return {parentLocator, filePath};
  }
}
