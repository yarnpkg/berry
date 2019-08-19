import {FSPath, PortablePath, Filename, toFilename, ppath} from '@berry/fslib';
import {PnpApi, PackageInformation}                        from '@berry/pnp';

import {PortablePnPApi}                                    from './PortablePnPApi';

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
export interface ResolvedPath<PathType extends FSPath<PortablePath>> {
  /**
   * Fully resolved path `/node_modules/...` path within PnP project,
   * `null` if path does not exist.
   */
  resolvedPath: PathType | null;

  /**
   * The path that should be used for stats. This field is returned for pathes ending
   * with `/node_modules[/@scope]`.
   *
   * These pathes are special in the sense they do not exists as physical dirs in PnP projects.
   * We emulate these pathes by forwarding issuer path to underlying fs.
   */
  statPath?: PortablePath;

  /**
   * Directory entries list, returned for pathes ending with `/node_modules[/@scope]`
   */
  dirList?: Filename[]
}

/**
 * Resolves `node_modules` paths inside PnP projects.
 *
 * The idea: for path like `node_modules/foo/node_modules/bar` we use `foo` as an issuer
 * and resolve `bar` for this issuer using `pnpapi`.
 */
export class NodePathResolver {
  private pnp: PortablePnPApi;

  /**
   * Constructs new instance of Node path resolver
   *
   * @param pnp PnP API instance
   */
  constructor(pnp: PnpApi) {
    this.pnp = new PortablePnPApi(pnp);
  }

  /**
   * Returns `readdir`-like result for partially resolved pnp path
   *
   * @param issuerInfo issuer package information
   * @param scope null - for `/node_modules` dir list or '@scope' - for `/node_modules/@scope` dir list
   *
   * @returns `undefined` - if dir does not exist, or `readdir`-like list of subdirs in the virtual dir
   */
  public readDir(issuerInfo: PackageInformation<PortablePath>, scope: string | null): Filename[] | undefined {
    const result = new Set<Filename>();
    for (const key of issuerInfo.packageDependencies.keys()) {
      const [pkgNameOrScope, pkgName] = key.split('/');
      if (!scope) {
        if (!result.has(toFilename(pkgNameOrScope))) {
          result.add(toFilename(pkgNameOrScope));
        }
      } else if (scope === pkgNameOrScope) {
        result.add(toFilename(pkgName));
      }
    }

    return result.size === 0 ? undefined : Array.from(result);
  }

  private getIssuer(pnp: PortablePnPApi, pathname: PortablePath): PortablePath | undefined {
    const locator = pnp.findPackageLocator(ppath.join(pathname, ppath.sep));
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
   * @param nodePath full path containing `node_modules`
   *
   * @returns resolved path
   */
  public resolvePath(nodePath: PortablePath): ResolvedPath<PortablePath> {
    const result: ResolvedPath<PortablePath> = {resolvedPath: nodePath};

    const marker = `/node_modules`;
    const index = nodePath.indexOf(marker);

    // Non-node_modules paths should not be processed
    if (index === -1 || (index + marker.length < nodePath.length && nodePath.charAt(index + marker.length) !== `/`))
      return result;

    // Directories that start with a dot are usually cache folders and shouldn't be touched
    if (nodePath.charAt(index + marker.length + 1) === `.`)
      return result;

    // Extract first issuer from the path using PnP API
    let issuer = this.getIssuer(this.pnp, nodePath);

    // If we have something left in a path to parse, do that
    if (issuer && nodePath.length > issuer.length) {
      let request: PortablePath = nodePath.slice(issuer.length) as PortablePath;

      let m;
      let rest;
      let pkgName;
      let partialPackageName = false;
      do {
        m = request.match(NODE_MODULES_REGEXP);
        if (m && issuer) {
          [,pkgName, rest] = m;
          request = rest as PortablePath;
          // Strip starting /
          pkgName = pkgName ? pkgName.substring(1) : pkgName;
          // Check if full package name was provided
          if (pkgName !== undefined) {
            if (pkgName.length > 0 && (pkgName[0] !== '@' || pkgName.indexOf(ppath.sep) > 0)) {
              try {
                let res = this.pnp.resolveToUnqualified(pkgName, ppath.join(issuer, ppath.sep));
                issuer = res === null || res === issuer ? undefined : res;
              } catch (e) {
                issuer = undefined;
                break;
              }
            } else {
              request = pkgName as PortablePath;
              pkgName = undefined;
              partialPackageName = true;
            }
          }
        }
        // Continue parsing path remainder until we have something left in a `request`
        // and we still have not lost the issuer
      } while (request && pkgName && issuer);

      if (issuer) {
        if (partialPackageName) {
          const locator = this.pnp.findPackageLocator(ppath.join(issuer, ppath.sep));
          const issuerInfo = locator ? this.pnp.getPackageInformation(locator) : undefined;
          if (issuerInfo) {
            const scope = request || null;
            result.dirList = this.readDir(issuerInfo, scope);
          }

          if (result.dirList) {
            result.statPath = issuer;
          } else {
            result.resolvedPath = null;
          }
        } else {
          result.resolvedPath = ppath.join(issuer, request);
        }
      } else {
        // If we don't have issuer here, it means the path cannot exist in PnP project
        result.resolvedPath = null;
      }
    }

    return result;
  }
}
