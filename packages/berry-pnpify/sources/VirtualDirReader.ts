import { ResolvedPath } from "./NodePathResolver";

/**
 * Virtual dirs reader for the dirs that end with `node_modules` and `node_modules/@some_scope`.
 *
 * These dirs are special for emulation of `node_modules` dependencies on the filesystem,
 * because they do not exist. And we need to emulate all the fs calls and events for these dirs.
 */
export class VirtualDirReader {
  private cache: { [dirName: string]: string[] | null } = {};

  /**
   * Constructs an instance of virtual `node_modules` and `node_modules/@scope` dir reader
   */
  constructor() {
  }

  /**
   * Returns `readdir`-like result for partially resolved pnp path
   *
   * @param pnpPath partially resolved PnP path
   *
   * @returns null - if dir does not exist, or `readdir`-like list of subdirs in the virtual dir
   */
  public readDir(pnpPath: ResolvedPath): string[] | null {
    if (pnpPath.issuer === undefined || pnpPath.request === undefined)
      return null;

    const dirName = pnpPath.issuer + pnpPath.request;
    if (!this.cache[dirName]) {
      const result = [];
      if (pnpPath.issuerInfo) {
        for (const key of pnpPath.issuerInfo.packageDependencies.keys()) {
          const [ scope, pkgName ] = key.split('/');
          if (pnpPath.request === '' && result.indexOf(scope) < 0) {
            result.push(scope);
          } else if (pnpPath.request === scope) {
            result.push(pkgName);
          }
        }
      }
      this.cache[dirName] = result.length > 0 ? result : null;
    }

    return this.cache[dirName];
  }
}