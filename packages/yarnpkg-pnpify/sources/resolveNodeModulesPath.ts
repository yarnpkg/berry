import {PortablePath, Filename, npath, ppath}              from '@yarnpkg/fslib';

import {NodeModulesTreeOptions, NodeModulesTree, LinkType} from './buildNodeModulesTree';

const NODE_MODULES = 'node_modules';

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
 * @param inputPath full path containing `node_modules`
 *
 * @returns resolved path
 */
export const resolveNodeModulesPath = (inputPath: PortablePath, nodeModulesTree: NodeModulesTree, options?: NodeModulesTreeOptions): ResolvedPath => {
  const result: ResolvedPath = {resolvedPath: inputPath};
  const segments = inputPath.split(ppath.sep);
  const lastNodeModulesIdx = segments.lastIndexOf(NODE_MODULES);
  if (lastNodeModulesIdx < 0)
    return result;

  let nodeModulesPath = segments.slice(0, lastNodeModulesIdx + 1).join(ppath.sep);
  let remainderParts = segments.slice(lastNodeModulesIdx + 1);
  let segCount = remainderParts.length;

  while (segCount >= 0) {
    const targetPath = [nodeModulesPath, ...remainderParts.slice(0, segCount)].join(ppath.sep);
    const request = remainderParts.slice(segCount).join(ppath.sep);
    const nodePath = npath.toPortablePath(targetPath);
    const node = nodeModulesTree.get(nodePath);
    if (node) {
      if (!node.dirList) {
        result.resolvedPath = npath.toPortablePath(node.target + (request ? ppath.sep + request : ''));
        if (node.linkType === LinkType.SOFT) {
          result.isSymlink = !request;
        } else if (node.linkType === LinkType.HARD && options && options.pnpifyFs) {
          result.isSymlink = true;
        }
      } else if (!request) {
        result.dirList = node.dirList;
        result.statPath = npath.toPortablePath(segments.slice(0, segments.indexOf(NODE_MODULES)).join(ppath.sep));
        // If node_modules is inside .zip archive, we use parent folder as a statPath instead
        if (result.statPath.endsWith('.zip')) {
          result.statPath = ppath.dirname(result.statPath);
        }
      }
      break;
    }
    segCount--;
  }

  return result;
};
