/**
 * PnP API locator options
 */
export interface PnPApiLocatorOptions {
    /**
     * Function that checks if file exists at given path.
     *
     * @param filePath file path
     */
    existsSync?: (filePath: string) => boolean;
    /**
     * PnP api filename.
     *
     * Default: `.pnp.js`
     */
    pnpFileName?: string;
}
/**
 * PnP API locator given arbitrary path answers the question is this path inside PnP project,
 * and if yes what is the path to PnP API file of this PnP project. If no - it returns null.
 *
 * PnP API locator tries to answer this question with minimal possible number of fs calls.
 *
 * Assumptions:
 *  - PnP project cannot be inside `node_modules`
 *  - PnP project cannot be inside other PnP project
 */
export declare class PnPApiLocator {
    private readonly options;
    private checkTree;
    /**
     * Constructs new instance of PnP API locator
     *
     * @param options optional locator options
     */
    constructor(options?: PnPApiLocatorOptions);
    /**
     * Returns all the path components for given path.
     *
     * @param sourcePath path
     *
     * @returns path components
     */
    private getPathComponents;
    /**
     * Finds PnP API file path for the given `sourcePath`.
     *
     * @param sourcePath some directory that might be inside or outside PnP project
     *
     * @returns null if `sourcePath` is not inside PnP project, or PnP API file path otherwise
     */
    findApi(sourcePath: string): string | null;
    /**
     * Tells the locator that the given path and all child paths should be rechecked
     *
     * @param sourcePath path to invalidate, empty string invalidates all the paths
     */
    invalidatePath(sourcePath: string): void;
}
