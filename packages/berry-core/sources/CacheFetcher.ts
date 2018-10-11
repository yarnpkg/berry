import {resolve}               from 'path';

import {Fetcher, FetchOptions} from './Fetcher';
import {Manifest}              from './Manifest';
import {Locator}               from './types';

export class CacheFetcher implements Fetcher {
  private readonly next: Fetcher;

  constructor(next: Fetcher) {
    this.next = next;
  }

  supports(locator: Locator) {
    return this.next.supports(locator);
  }

  async fetchManifest(locator: Locator, opts: FetchOptions) {
    const {entity} = await opts.cache.fetchFromCache(locator, () => {
      return this.next.fetch(locator, opts);
    });
    
    const manifest = new Manifest();
    manifest.load(await entity.readJson(`package.json`));

    // Since it comes from an archive, it's immutable and we freeze its content
    Object.freeze(manifest);

    return manifest;
  }

  async fetch(locator: Locator, opts: FetchOptions) {
    const {file} = await opts.cache.fetchFromCache(locator, () => {
      return this.next.fetch(locator, opts);
    });

    return file;
  }
}
