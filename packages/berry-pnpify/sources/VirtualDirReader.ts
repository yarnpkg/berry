import { ResolvedPath } from "./NodePathResolver";

/**
 * Virtual dirs reader for the dirs `/node_modules[/@foo][/bar]`.
 *
 * These dirs are special for emulation of `node_modules` dependencies on the filesystem,
 * because they either do not exist or even whey they exist, they should have modification
 * >= time of PnP API file.
 */
export class VirtualDirReader {

  /**
   * Returns `readdir`-like result for partially resolved pnp path
   *
   * @param pnpPath partially resolved PnP path
   *
   * @returns `null` - if dir does not exist, or `readdir`-like list of subdirs in the virtual dir
   */
  public readDir(pnpPath: ResolvedPath): string[] | null {
    if (pnpPath.issuer === undefined || pnpPath.request === undefined)
      return null;

    const result = [];
    if (pnpPath.issuerInfo) {
      for (const key of pnpPath.issuerInfo.packageDependencies.keys()) {
        const [ scope, pkgName ] = key.split('/');
        if (!pnpPath.request) {
          if (result.indexOf(scope) < 0) {
            result.push(scope);
          }
        } else if (pnpPath.request === scope) {
          result.push(pkgName);
        }
      }
    }

    return result.length === 0 ? null : result;
  }
}