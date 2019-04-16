import { xfs } from '@berry/fslib';

/**
 * PnP root locator options
 */
export interface PnPLocatorOptions {
  /**
   * Function that checks if file exists at given path.
   *
   * Default: `xfs.existsSync`
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
 * Assumptions:
 *  - PnP root cannot be inside `node_modules`
 *  - PnP root cannot be inside other PnP root
 */
export class PnPRootLocator {
  private readonly options: DefinedPnPLocatorOptions;
  private checkTree: PnPRootCheckTree;

  /**
   * Constructs new instance of PnP root locator
   *
   * @param options optional locator options
   */
  constructor(options?: PnPLocatorOptions) {
    const opts = options || {};
    this.options = {
      existsSync: opts.existsSync || xfs.existsSync.bind(xfs),
      pnpFileName: opts.pnpFileName || '.pnp.js'
    };
    this.checkTree = new Map();
  }

  /**
   * Returns all the path components for given path.
   *
   * @param sourcePath path
   *
   * @returns path components
   */
  private getPathComponents(sourcePath: string): string[] {
    const normalizedPath = sourcePath.replace(/\\/g, '/').replace(/\/+$/, '');
    const idx = normalizedPath.indexOf('\/node_modules');
    return (idx >= 0 ? normalizedPath.substring(0, idx) : normalizedPath).split('/');
  }

  /**
   * Finds PnP root directory for given `sourcePath`.
   *
   * @param sourcePath some directory that might be inside or outside PnP project
   *
   * @returns null if `sourcePath` is not inside PnP project, or root directory of PnP project otherwise
   */
  public findApiRoot(sourcePath: string): string | null {
    let apiPath = null;
    const pathComponentList = this.getPathComponents(sourcePath);

    let currentPath;
    let node = this.checkTree;
    for (const pathComponent of pathComponentList) {
      currentPath = typeof currentPath === 'undefined' ? pathComponent : currentPath + '/' + pathComponent;
      let val = node.get(pathComponent);
      if (typeof val === 'undefined') {
        val = this.options.existsSync(currentPath + '/' + this.options.pnpFileName) ? true : new Map();
        node.set(pathComponent, val);
      }
      if (val === true) {
        apiPath = currentPath;
        break;
      }
      node = val;
    }

    return apiPath;
  }

  /**
   * Tell locator that the given path and all child paths should be rechecked
   *
   * @param sourcePath path to invalidate, empty string invalidates all the paths
   */
  invalidatePath(sourcePath: string) {
    const pathComponentList = this.getPathComponents(sourcePath);
    let node = this.checkTree;
    for (const pathComponent of pathComponentList.slice(0, -1)) {
      node = node.get(pathComponent);
      if (typeof node === 'undefined') {
        break;
      }
    }
    if (typeof node !== 'undefined') {
      node.delete(pathComponentList[pathComponentList.length - 1]);
    }
  }
}
