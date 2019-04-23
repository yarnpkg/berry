import { PnPApiLoader } from './PnPApiLoader';
import { NodeFS } from '@berry/fslib';
import { PnpApi, PackageInformation } from '@berry/pnp';

/**
 * Node path resolver options
 */
export interface NodePathResolverOptions {
  /**
   * PnP API loader
   *
   * Default: new instance of PnPApiLoader
   */
  apiLoader?: PnPApiLoader
}

interface DefinedNodePathResolverOptions {
  apiLoader: PnPApiLoader
}

/**
 * Regexp for pathname that catches the following paths:
 *
 * 1. A path without `/node_modules` in the beginning. We don't process these, since they cannot be inside any of PnP package roots
 * 2. A path with complete package name inside, e.g. `/node_modules/pkg-name` or `/node_modules/@scope/pkg-name`
 * 3. A path with incomplete package name inside, e.g. `/node_modules` or `/node_modules/@scope`
 *
 * And everything at the end of the pathname
 */
const NODE_MODULES_REGEXP = /(\/node_modules(?:(\/[^@][^\/]+|\/@[^\/]+\/[^\/]+)|(\/@[^\/]+|$)))?(.*)/;

/**
 * Resolved `/node_modules` path inside PnP project info
 */
interface ResolvedPath {
  /**
   * Fully resolved path, `null` if path is within PnP project, but does not exist,
   * `undefined` if path is within PnP project but is a container dir that
   * cannot be fully resolved, i.e. `../node_modules` or `.../node_modules/@scope`
   * in this case `PartiallyResolvedPath` fields will be returned
   */
  resolvedPath?: string | null;

  // Final PnP issuer package info, present if `resolvedPath` undefined
  issuer?: PackageInformation;
  // Request inside issuer path, present if `resolvedPath` undefined
  request?: string;
}

/**
 * Resolves `node_modules` paths inside PnP projects.
 *
 * The idea: for path like `node_modules/foo/node_modules/bar` we use `foo` as an issuer
 * and resolve `bar` for this issuer using `pnpapi`.
 */
export class NodePathResolver {
  private options: DefinedNodePathResolverOptions;

  /**
   * Constructs new instance of Node path resolver
   *
   * @param options optional Node path resolver options
   */
  constructor(options?: NodePathResolverOptions) {
    const opts = options || {};
    this.options = {
      apiLoader: opts.apiLoader || new PnPApiLoader()
    };
  }

  private getIssuer(pnp: PnpApi, pathname: string): string | undefined {
    const locator = pnp.findPackageLocator(pathname + '/');
    const info = locator && pnp.getPackageInformation(locator);
    return !info ? undefined : info.packageLocation;
  }

  /**
   * Resolves paths containing `node_modules` inside PnP projects.
   *
   * This method extracts `.../node_modules/pkgName/...` from the path
   * and uses previous package as an issuer for the next package.
   * It detects whether partial package name was specified, e.g. `/node_modules/@scope`
   * or `/node_modules` (it is considered partial package too, because it points to a directory,
   * not to a concrete package). Partial package can be specified only at the end of the path,
   * so if this is the case, the method stops and returns issuer info and partial package name
   * in `request` field of the result. If only full package names were specified the method
   * returns only `resolvedPath` field in a result, which points to a real path within some
   * PnP dependency.
   *
   * @param nodePath path containing `node_modules`
   *
   * @returns resolved path
   */
  public resolvePath(nodePath: string): ResolvedPath {
    const result: ResolvedPath = { resolvedPath: nodePath };
    const pathname = NodeFS.toPortablePath(nodePath);
    const pnp = this.options.apiLoader.getApi(nodePath);
    if (pnp) {
      // Extract first issuer from the path using PnP API
      let issuer = this.getIssuer(pnp, pathname);
      let request: string | undefined;

      // If we have something left in a path to parse, do that
      if (issuer && pathname.length > issuer.length) {
        request = pathname.substring(issuer.length);

        let m;
        let pkgName;
        let partialPkgName;
        do {
            m = request.match(NODE_MODULES_REGEXP);
            if (m) {
              [,,pkgName, partialPkgName, request] = m;
              // Strip starting /
              pkgName = pkgName ? pkgName.substring(1) : pkgName;
              // Strip starting /
              partialPkgName = partialPkgName ? partialPkgName.substring(1) : partialPkgName;
              if (pkgName) {
                try {
                  const res = pnp.resolveToUnqualified(pkgName, issuer + '/');
                  issuer = res === null ? undefined : res;
                } catch (e) {
                  issuer = undefined;
                  break;
                }
              }
            }
          // Continue parsing path remainder until we have something left in a `request` and
          // we have received full package name
        } while (pkgName && request);

        if (issuer) {
          if (partialPkgName !== undefined) {
            delete result.resolvedPath;
            result.request = partialPkgName;
            const locator = pnp.findPackageLocator(issuer + '/');
            const pkgInfo = locator ? pnp.getPackageInformation(locator) : undefined;
            result.issuer = pkgInfo === null ? undefined : pkgInfo;
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