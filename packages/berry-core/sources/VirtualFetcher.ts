import {AliasFS, NodeFS, PortablePath, xfs, ppath, npath}        from '@berry/fslib';

import {Fetcher, FetchOptions, FetchResult, MinimalFetchOptions} from './Fetcher';
import {MessageName, ReportError}                                from './Report';
import * as structUtils                                          from './structUtils';
import {Locator}                                                 from './types';

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
    return structUtils.slugifyLocator(locator)
  }

  getLocatorPath(locator: Locator, opts: MinimalFetchOptions) {
    const virtualFolder = opts.project.configuration.get(`virtualFolder`);
    const virtualPath = ppath.resolve(virtualFolder, this.getLocatorFilename(locator));

    return virtualPath;
  }

  private async ensureVirtualLink(locator: Locator, sourceFetch: FetchResult, opts: FetchOptions) {
    const virtualPath = this.getLocatorPath(locator, opts);

    const from = ppath.dirname(virtualPath);
    const to = sourceFetch.packageFs.getRealPath();

    let target = ppath.relative(from, to);

    const fromParse = npath.parse(NodeFS.fromPortablePath(from));
    const toParse = npath.parse(NodeFS.fromPortablePath(to));

    if (fromParse.root !== toParse.root) {
      if (opts.project.configuration.get(`enableAbsoluteVirtuals`)) {
        target = to;
      } else {
        throw new ReportError(MessageName.CROSS_DRIVE_VIRTUAL_LOCAL, `The virtual folder (${fromParse.root}) must be on the same drive as the local package it references (${toParse.root})`);
      }
    }

    // Doesn't need locking, and the folder must exist for the lock to succeed
    await xfs.mkdirpPromise(ppath.dirname(virtualPath));

    await xfs.lockPromise(virtualPath, async () => {
      let currentLink;
      try {
        currentLink = await xfs.readlinkPromise(virtualPath);
      } catch (error) {
        if (error.code !== `ENOENT`) {
          throw error;
        }
      }

      if (currentLink !== undefined && currentLink !== target)
        throw new Error(`Conflicting virtual paths (current ${currentLink} != new ${target})`);

      if (currentLink === undefined) {
        await xfs.symlinkPromise(`${target}/` as PortablePath, virtualPath);
      }
    });

    return {
      ...sourceFetch,
      packageFs: new AliasFS(virtualPath, {baseFs: sourceFetch.packageFs, pathUtils: ppath}),
    };
  }
}
