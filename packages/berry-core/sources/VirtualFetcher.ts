import {AliasFS, FakeFS, ZipFS}             from '@berry/zipfs';
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

  async fetch(locator: Locator, opts: FetchOptions) {
    const splitPoint = locator.reference.indexOf(`#`);

    if (splitPoint === -1)
      throw new Error(`Invalid virtual package reference`);

    const nextReference = locator.reference.slice(splitPoint + 1);
    const nextLocator = structUtils.makeLocator(locator, nextReference);

    const [parentFs, release] = await opts.fetcher.fetch(nextLocator, opts);

    try {
      return [await this.ensureVirtualLink(locator, parentFs, opts), release] as FetchResult;
    } catch (error) {
      await release();
      throw error;
    }
  }

  private async ensureVirtualLink(locator: Locator, targetFs: FakeFS, opts: FetchOptions) {
    let virtualLink = resolve(opts.project.configuration.virtualFolder, opts.cache.getCacheKey(locator));
    if (targetFs instanceof ZipFS)
      virtualLink += `.zip`;

    let currentLink;
    try {
      currentLink = await readlinkP(virtualLink);
    } catch (error) {
      if (error.code !== `ENOENT`) {
        throw error;
      }
    }

    const relativeTarget = relative(dirname(virtualLink), targetFs.getRealPath());

    if (currentLink !== undefined && currentLink !== relativeTarget)
      throw new Error(`Conflicting virtual paths (${currentLink} != ${relativeTarget})`);

    if (currentLink === undefined) {
      await mkdirp(dirname(virtualLink));
      await symlinkP(relativeTarget, virtualLink);
    }

    return new AliasFS(virtualLink, {baseFs: targetFs});    
  }
}
