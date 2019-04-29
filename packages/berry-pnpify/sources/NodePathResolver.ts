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
 * Resolved `/node_modules` path inside PnP project info
 */
export interface ResolvedPath {
  /**
   * Fully resolved path `/node_modules/...` path within PnP project,
   * `null` if path does not exist, `undefined` if path cannot be fully resolved, .e.g. has
   * the form `/node_modules[/@foo]`, in this case `request` will contain '' or '@foo'
   */
  resolvedPath?: string | null;

  /**
   * Path to PnP API filename, present if path is inside PnP project and contains `/node_modules`
   */
  apiPath?: string | null;

  /**
   * Final PnP issuer path (without trailing /)
   */
  issuer?: string;

  /**
   * Final PnP issuer package info
   */
  issuerInfo?: PackageInformation;

  /**
   * Unresolved request inside issuer path, either '' or '@foo'
   */
  request?: string;
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

  private getIssuer(pnp: PnpApi, pathname: string): string | undefined {
    const locator = pnp.findPackageLocator(pathname + '/');
    const info = locator && pnp.getPackageInformation(locator);
    return !info ? undefined : info.packageLocation;
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
    const pathname = nodePath.replace('\\', '/');
    const result: ResolvedPath = { resolvedPath: nodePath };
    if (pathname.indexOf('/node_modules') < 0) 
      // Non-node_modules paths should not be processed
      return result;
    
    const pnpApiPath = this.options.apiLocator.findApi(nodePath);
    result.apiPath = pnpApiPath;
    const pnp = pnpApiPath && this.options.apiLoader.getApi(pnpApiPath);
    if (pnpApiPath && pnp) {
      // Extract first issuer from the path using PnP API
      let issuer = this.getIssuer(pnp, pathname);
      let request: string | undefined;

      // If we have something left in a path to parse, do that
      if (issuer && pathname.length > issuer.length) {
        request = pathname.substring(issuer.length);

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
              if (pkgName) {
                if (pkgName[0] !== '@' || pkgName.indexOf('/') > 0) {
                  try {
                    const res = pnp.resolveToUnqualified(pkgName, issuer + '/');
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
            delete result.resolvedPath;
            result.issuer = issuer;
            result.apiPath = pnpApiPath;
            result.request = request;
            const locator = pnp.findPackageLocator(issuer + '/');
            const pkgInfo = locator ? pnp.getPackageInformation(locator) : undefined;
            result.issuerInfo = pkgInfo === null ? undefined : pkgInfo;
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