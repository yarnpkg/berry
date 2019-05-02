import { NodeFS }                     from '@berry/fslib';
import { PnpApi, PackageInformation } from '@berry/pnp';

import { PnPApiLoader }               from './PnPApiLoader';
import { PnPApiLocator }              from './PnPApiLocator';

/**
 * Node path resolver options
 */
export interface NodePathResolverOptions {
  /**
   * PnP API loader
   */
  apiLoader: PnPApiLoader

  /**
   * PnP API locator
   */
  apiLocator: PnPApiLocator
}

/**
 * Regexp for pathname that catches the following paths:
 *
 * 1. A path without `/node_modules` in the beginning. We don't process these, since they cannot be inside any of PnP package roots
 * 2. A path with incomplete or complete package name inside, e.g. `/node_modules[/@scope][/foo]`
 *
 * And everything at the end of the pathname
 */
const NODE_MODULES_REGEXP = /(?:\/node_modules((?:\/@[^\/]+)?(?:\/[^@][^\/]+)?))?(.*)/;

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
  dirList?: string[]
}

/**
 * Resolves `node_modules` paths inside PnP projects.
 *
 * The idea: for path like `node_modules/foo/node_modules/bar` we use `foo` as an issuer
 * and resolve `bar` for this issuer using `pnpapi`.
 */
export class NodePathResolver {
  private options: NodePathResolverOptions;

  /**
   * Constructs new instance of Node path resolver
   *
   * @param options optional Node path resolver options
   */
  constructor(options: NodePathResolverOptions) {
    this.options = options;
  }

  /**
   * Returns `readdir`-like result for partially resolved pnp path
   *
   * @param issuerInfo issuer package information
   * @param request either '' or '@scope'
   *
   * @returns `undefined` - if dir does not exist, or `readdir`-like list of subdirs in the virtual dir
   */
  public readDir(issuerInfo: PackageInformation, request: string): string[] | undefined {
    const result = [];
    for (const key of issuerInfo.packageDependencies.keys()) {
      const [ scope, pkgName ] = key.split('/');
      if (!request) {
        if (result.indexOf(scope) < 0) {
          result.push(scope);
        }
      } else if (request === scope) {
        result.push(pkgName);
      }
    }

    return result.length === 0 ? undefined : result;
  }

  private getIssuer(pnp: PnpApi, pathname: string): string | undefined {
    const locator = pnp.findPackageLocator(pathname + '/');
    const info = locator && pnp.getPackageInformation(locator);
    return !info ? undefined : NodeFS.toPortablePath(info.packageLocation);
  }

  /**
   * Resolves paths containing `/node_modules` inside PnP projects. If path is outside PnP
   * project it is not changed.
   *
   * This method extracts `.../node_modules/pkgName/...` from the path
   * and uses previous package as an issuer for the next package.
   *
   * @param nodePath path containing `node_modules`
   *
   * @returns resolved path
   */
  public resolvePath(nodePath: string): ResolvedPath {
    const result: ResolvedPath = { resolvedPath: nodePath };
    if (nodePath.indexOf('/node_modules') < 0)
      // Non-node_modules paths should not be processed
      return result;

    const pnpApiPath = this.options.apiLocator.findApi(nodePath);
    const pnp = pnpApiPath && this.options.apiLoader.getApi(pnpApiPath);
    if (pnpApiPath && pnp) {
      // Extract first issuer from the path using PnP API
      let issuer = this.getIssuer(pnp, nodePath);
      let request: string | undefined;

      // If we have something left in a path to parse, do that
      if (issuer && nodePath.length > issuer.length) {
        request = nodePath.substring(issuer.length);

        let m;
        let pkgName;
        let partialPackageName = false;
        do {
          m = request.match(NODE_MODULES_REGEXP);
          if (m) {
            [,pkgName, request] = m;
            // Strip starting /
            pkgName = pkgName ? pkgName.substring(1) : pkgName;
            // Check if full package name was provided
            if (pkgName !== undefined) {
              if (pkgName.length > 0 && (pkgName[0] !== '@' || pkgName.indexOf('/') > 0)) {
                try {
                  let res = pnp.resolveToUnqualified(pkgName, issuer + '/');
                  if (res) {
                    res = NodeFS.toPortablePath(res);
                  }
                  issuer = res === null || res === issuer ? undefined : res;
                } catch (e) {
                  issuer = undefined;
                  break;
                }
              } else {
                request = pkgName;
                pkgName = undefined;
                partialPackageName = true;
              }
            }
          }
          // Continue parsing path remainder until we have something left in a `request`
          // and we still have not lost the issuer
        } while (request && pkgName);

        if (issuer) {
          if (partialPackageName) {
            const locator = pnp.findPackageLocator(issuer + '/');
            const issuerInfo = locator ? pnp.getPackageInformation(locator) : undefined;
            if (issuerInfo)
              result.dirList = this.readDir(issuerInfo, request);


            if (result.dirList) {
              result.statPath = issuer;
            } else {
              result.resolvedPath = null;
            }
          } else {
            result.resolvedPath = issuer + request;
          }
        }
      }

      // If we don't have issuer here, it means the path cannot exist in PnP project
      if (!issuer) {
        result.resolvedPath = null;
      }
    }

    return result;
  }
}
