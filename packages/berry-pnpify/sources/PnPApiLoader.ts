import EventEmitter from 'events';

import { PnpApi } from '@berry/pnp';

/**
 * PnP API locator options
 */
export interface PnPApiLoaderOptions {
  /**
   * Uncached require function
   *
   * Default: `delete require.cache[...]; require(..)`
   *
   * @param modulePath modulePath
   */
  uncachedRequire?: (modulePath: string) => any;

  /**
   * Watch for PnP API file changes
   */
  watch: (filePath: string, listener: (event: string, filename: string) => any) => any;
}

interface DefinedPnPApiLoaderOptions {
  uncachedRequire: (modulePath: string) => PnpApi;
  watch: (filePath: string, listener: (event: string, filename: string) => any) => any;
}

interface CacheEntry {
  pnpApi: PnpApi;
  watched: boolean;
}

/**
 * Loads PnP API from the PnP API path in a cached way, then
 * watches for changes to this file and if any - invalidates cache
 * and emits an event
 */
export class PnPApiLoader extends EventEmitter {
  private cachedApis: { [filePath: string]: CacheEntry } = {};
  private options: DefinedPnPApiLoaderOptions;

  /**
   * Constructs new instance of PnP API loader
   *
   * @param options optional loader options
   */
  constructor(options: PnPApiLoaderOptions) {
    super();
    const opts: any = options || {};
    this.options = {
      uncachedRequire: opts.uncachedRequire || ((modulePath: string): any => {
        delete require.cache[require.resolve(modulePath)];
        return require(modulePath);
      }),
      watch: opts.watch
    };
  }

  /**
   * Requires and returns PnP API in a cached way and then
   * watches for PnP API file changes.
   *
   * If changes to PnP API file will be detected next call to this function
   * will reload PnP API afresh and returns it.
   *
   * On PnP API file change watch event will be emitted on this class
   *
   * @param pnpApiPath path to PnP API file
   *
   * @returns `pnpapi` instance for the given PnP API file
   */
  getApi(pnpApiPath: string): PnpApi {
    const cacheEntry = this.cachedApis[pnpApiPath] || {};
    if (!cacheEntry.pnpApi) {
      cacheEntry.pnpApi = this.options.uncachedRequire(pnpApiPath);
      if (cacheEntry.pnpApi && !cacheEntry.watched) {
        this.options.watch(pnpApiPath, (event: string, filename: string) => {
          delete cacheEntry.pnpApi;
          this.emit(event, filename);
        });
        cacheEntry.watched = true;
      }
    }

    if (cacheEntry.watched) {
      this.cachedApis[pnpApiPath] = cacheEntry;
    }

    return cacheEntry.pnpApi;
  }
}
