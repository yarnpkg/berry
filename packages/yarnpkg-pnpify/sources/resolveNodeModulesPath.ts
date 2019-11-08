import {PortablePath, Filename, npath, ppath}              from '@yarnpkg/fslib';

import {NodeModulesTreeOptions, NodeModulesTree, LinkType} from './buildNodeModulesTree';

const NODE_MODULES_SUFFIX = '/node_modules';

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
   * Fully resolved path `/node_modules/...` path within PnP project
   */
  resolvedPath: PortablePath;

  /** Realpath to be returned to the user */
  realPath: PortablePath;

  /** Last path inside node_modules tree */
  treePath?: PortablePath;

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
  dirList?: Set<Filename>;

  /**
   * If true, the entry is meant to be a symbolic link to the location pointed by resolvedPath.
   */
  isSymlink?: boolean;
}


/**
 * Resolves paths containing `/node_modules` inside PnP projects. If path is outside PnP
 * project it is not changed.
 *
 * @param nodePath full path containing `node_modules`
 *
 * @returns resolved path
 */
export const resolveNodeModulesPath = (nodePath: PortablePath, nodeModulesTree: NodeModulesTree, options?: NodeModulesTreeOptions): ResolvedPath => {
  const result: ResolvedPath = {resolvedPath: nodePath, realPath: nodePath};
  if (nodePath.indexOf(NODE_MODULES_SUFFIX) < 0)
    return result;
  let lastIdx = nodePath.lastIndexOf(NODE_MODULES_SUFFIX) + NODE_MODULES_SUFFIX.length;
  let targetPath = nodePath.substring(0, lastIdx);
  let remainderParts = nodePath.substring(lastIdx).split(ppath.sep).slice(1);
  let requestStartIdx = 0;
  if (remainderParts.length > 0) {
    if (remainderParts[0][0] !== '@' || remainderParts.length === 1)
      requestStartIdx = 1;
    else
      requestStartIdx = 2;

    targetPath = targetPath + ppath.sep + remainderParts.slice(0, requestStartIdx).join(ppath.sep);
  }
  const request = remainderParts.slice(requestStartIdx).join(ppath.sep);
  const treePath = npath.toPortablePath(targetPath);
  const node = nodeModulesTree.get(treePath);
  if (node) {
    result.treePath = treePath;
    if (Array.isArray(node)) {
      const [location, linkType] = node;
      result.resolvedPath = npath.toPortablePath(location + (request ? ppath.sep + request : ''));
      if (linkType === LinkType.SOFT) {
        result.realPath = result.resolvedPath;
        result.isSymlink = !request;
      } else if (linkType === LinkType.HARD && options && options.pnpifyFs) {
        result.isSymlink = true;
        result.realPath = result.resolvedPath;
      }
    } else if (!request) {
      result.dirList = node;
      result.statPath = npath.toPortablePath(nodePath.substring(0, nodePath.indexOf(NODE_MODULES_SUFFIX)));
    }
  }
  return result;
};
