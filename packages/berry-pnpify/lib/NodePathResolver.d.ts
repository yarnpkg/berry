import { PackageInformation } from '@berry/pnp';
import { PnPApiLoader } from './PnPApiLoader';
import { PnPApiLocator } from './PnPApiLocator';
/**
 * Node path resolver options
 */
export interface NodePathResolverOptions {
    /**
     * PnP API loader
     */
    apiLoader: PnPApiLoader;
    /**
     * PnP API locator
     */
    apiLocator: PnPApiLocator;
}
/**
 * Resolved `/node_modules` path inside PnP project info.
 *
 * Dirs ending with '/node_modules/foo/node_modules' or '.../node_modules/foo/node_modules/@scope'
 * do not physically exist, but we must pretend they do exist if package `foo` has dependencies
 * and there is some package `@scope/bar` inside these dependencies. We need two things to emulate
 * these dirs existence:
 *
 * 1. List of entries in these dirs. We retrieve them by calling PnP API and getting dependencies
 *    for the issuer `.../foo/` and store into `dirList` field
 * 2. And we need either fake stats or we can forward underlying fs to stat the issuer dir.
 *    The issuer dir exists on fs. We store issuer dir into `statPath` field
 */
export interface ResolvedPath {
    /**
     * Fully resolved path `/node_modules/...` path within PnP project,
     * `null` if path does not exist.
     */
    resolvedPath: string | null;
    /**
     * The path that should be used for stats. This field is returned for pathes ending
     * with `/node_modules[/@scope]`.
     *
     * These pathes are special in the sense they do not exists as physical dirs in PnP projects.
     * We emulate these pathes by forwarding issuer path to underlying fs.
     */
    statPath?: string;
    /**
     * Directory entries list, returned for pathes ending with `/node_modules[/@scope]`
     */
    dirList?: string[];
}
/**
 * Resolves `node_modules` paths inside PnP projects.
 *
 * The idea: for path like `node_modules/foo/node_modules/bar` we use `foo` as an issuer
 * and resolve `bar` for this issuer using `pnpapi`.
 */
export declare class NodePathResolver {
    private options;
    /**
     * Constructs new instance of Node path resolver
     *
     * @param options optional Node path resolver options
     */
    constructor(options: NodePathResolverOptions);
    /**
     * Returns `readdir`-like result for partially resolved pnp path
     *
     * @param issuerInfo issuer package information
     * @param scope null - for `/node_modules` dir list or '@scope' - for `/node_modules/@scope` dir list
     *
     * @returns `undefined` - if dir does not exist, or `readdir`-like list of subdirs in the virtual dir
     */
    readDir(issuerInfo: PackageInformation, scope: string | null): string[] | undefined;
    private getIssuer;
    /**
     * Resolves paths containing `/node_modules` inside PnP projects. If path is outside PnP
     * project it is not changed.
     *
     * This method extracts `.../node_modules/pkgName/...` from the path
     * and uses previous package as an issuer for the next package.
     *
     * @param nodePath full path containing `node_modules`
     *
     * @returns resolved path
     */
    resolvePath(nodePath: string): ResolvedPath;
}
