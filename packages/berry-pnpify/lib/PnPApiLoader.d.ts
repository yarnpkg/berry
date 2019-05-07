/// <reference types="node" />
import { PnpApi } from '@berry/pnp';
import EventEmitter from 'events';
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
    watch: (filePath: string, options?: {
        persistent?: boolean;
        recursive?: boolean;
        encoding?: string;
    }, listener?: (event: string, filename: string) => any) => any;
}
/**
 * Loads PnP API from the PnP API path in a cached way, then
 * watches for changes to this file and if any - invalidates cache
 * and emits an event
 */
export declare class PnPApiLoader extends EventEmitter {
    private cachedApis;
    private options;
    /**
     * Constructs new instance of PnP API loader
     *
     * @param options optional loader options
     */
    constructor(options: PnPApiLoaderOptions);
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
    getApi(pnpApiPath: string): PnpApi;
}
