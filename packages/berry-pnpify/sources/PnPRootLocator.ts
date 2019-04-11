import * as fs from 'fs';

/**
 * PnP root locator options
 */
export interface PnPLocatorOptions {
  /**
   * Function that checks if file exists at given path.
   *
   * Default: `fs.existsSync`
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

interface DefinedPnPLocatorOptions {
  existsSync: (filePath: string) => boolean;
  pnpFileName: string;
}

/**
 * A tree structure to minimize the number of fs calls to check for pnp api file existence.
 *
 * The nodes of the tree are subdirectory names and the value is either true if the tree path leads
 * to the PnP API filename or the subtree if the tree path do not lead to PnP API filename.
 *
 * Example:
 *
 *                             <root>
 *                               |
 *                              home
 *                               |
 *                              user
 *                   /                           \
 *              pnp_project_dir                some_dir
 *                  |                          /     \
 *                true        pnp_project_subdir     non_pnp_project_subdir
 *                                  |                     |          |
 *                                 true                 dir1       dir2
 *                                                        |          |
 *                                                       ...        ...
 */
type PnPRootCheckTree = Map<string, any | true>;

/**
 * PnP root locator given arbitrary path answer the question is this path inside PnP project,
 * and if yes what is the root directory of this PnP project. If no - it returns null.
 *
 * PnP root locator tries to answer this question with minimal possible number of fs calls.
 *
 * Note, it does not handle the case when PnP projects are added or removed during
 * the lifespan of currently running node proces.
 */
export class PnPRootLocator {
  private readonly options: DefinedPnPLocatorOptions;
  private checkTree: PnPRootCheckTree;

  constructor(options?: PnPLocatorOptions) {
    const opts = options || {};
    this.options = {
      existsSync: opts.existsSync || fs.existsSync.bind(fs),
      pnpFileName: opts.pnpFileName || '.pnp.js'
    };
    this.checkTree = new Map();
  }

  /**
   * Finds PnP root directory for given `sourcePath`.
   *
   * Note, this method assumes PnP root cannot be inside `node_modules`
   *
   * @param sourcePath some directory that might be inside or outside PnP project
   *
   * @returns null if `sourcePath` is not inside PnP project, or root directory of PnP project otherwise
   */
  public findApiRoot(sourcePath: string): string | null {
    let apiPath = null;
    const normalizedPath = sourcePath.replace(/\\/g, '/');
    const matches = normalizedPath.match(/^(.*)(?:\/node_modules(?:\/|$).*)?/);
    if (matches) {
      const basePath = matches[1];
      const subdirs = basePath.split('/');
      let currentPath;
      let node = this.checkTree;
      for (const subdir of subdirs) {
        currentPath = typeof currentPath === 'undefined' ? subdir : currentPath + '/' + subdir;
        let val = node.get(subdir);
        if (typeof val === 'undefined') {
          val = this.options.existsSync(currentPath + '/' + this.options.pnpFileName) ? true : new Map();
          node.set(subdir, val);
        }
        if (val === true) {
          apiPath = currentPath;
          break;
        }
        node = val;
      }
    }

    return apiPath;
  }
}
