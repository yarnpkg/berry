import * as fs from 'fs';

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

interface DefinedPnPApiLocatorOptions {
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
 * PnP API locator given arbitrary path answers the question is this path inside PnP project,
 * and if yes what is the path to PnP API file of this PnP project. If no - it returns null.
 *
 * PnP API locator tries to answer this question with minimal possible number of fs calls.
 *
 * Assumptions:
 *  - PnP project cannot be inside `node_modules`
 *  - PnP project cannot be inside other PnP project
 */
export class PnPApiLocator {
  private readonly options: DefinedPnPApiLocatorOptions;
  private checkTree: PnPRootCheckTree;

  /**
   * Constructs new instance of PnP API locator
   *
   * @param options optional locator options
   */
  constructor(options?: PnPApiLocatorOptions) {
    const opts: any = options || {};
    this.options = {
      existsSync: opts.existsSync || fs.existsSync.bind(fs),
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
   * Finds PnP API file path for the given `sourcePath`.
   *
   * @param sourcePath some directory that might be inside or outside PnP project
   *
   * @returns null if `sourcePath` is not inside PnP project, or PnP API file path otherwise
   */
  public findApi(sourcePath: string): string | null {
    let apiPath = null;
    const pathSep = sourcePath.indexOf('\\') >= 0 ? '\\' : '/';
    const pathComponentList = this.getPathComponents(sourcePath);

    let currentDir;
    let node = this.checkTree;
    for (const pathComponent of pathComponentList) {
      currentDir = typeof currentDir === 'undefined' ? pathComponent : currentDir + pathSep + pathComponent;
      let currentPath = currentDir + pathSep + this.options.pnpFileName;

      let val = node.get(pathComponent);
      if (typeof val === 'undefined') {
        val = this.options.existsSync(currentPath) ? true : new Map();
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
   * Tells the locator that the given path and all child paths should be rechecked
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
