import {PortablePath, Filename}    from '@yarnpkg/fslib';
import {toFilename, npath, ppath}  from '@yarnpkg/fslib';

import {NodeModulesTree, LinkType} from './buildNodeModulesTree';

const NODE_MODULES = `node_modules`;

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
   * This field is returned for pathes ending with `/node_modules[/@scope]`.
   *
   * These pathes are special in the sense they do not exists as physical dirs in PnP projects.
   *
   * We emulate these pathes by forwarding to real physical path on underlying fs.
   */
  forwardedDirPath?: PortablePath;

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
export const resolveNodeModulesPath = (inputPath: PortablePath, nodeModulesTree: NodeModulesTree): ResolvedPath => {
  const result: ResolvedPath = {resolvedPath: inputPath};
  const segments = inputPath.split(ppath.sep);

  const firstIdx = segments.indexOf(NODE_MODULES);
  if (firstIdx < 0)
    return result;
  let lastIdx = segments.lastIndexOf(NODE_MODULES);
  if (typeof segments[lastIdx + 1] !== `undefined`)
    // We have the situation .../node_modules/{something or @something}
    lastIdx++;
  if (segments[lastIdx][0] === `@` && typeof segments[lastIdx + 1] !== `undefined`)
    // We have the situation .../node_modules/@something/{foo}
    lastIdx++;

  // We lookup all the path substrings that end on [firstIdx..lastIdx] in the node_modules tree
  // and follow them if they are symlinks
  let locationCandidate = npath.toPortablePath(segments.slice(0, firstIdx).join(ppath.sep));
  let node, lastNode, lastNodeLocation: PortablePath;
  let curIdx = firstIdx;

  let request = PortablePath.dot;
  while (curIdx <= lastIdx) {
    const curSegment = toFilename(segments[curIdx]);
    locationCandidate = ppath.join(locationCandidate, curSegment);
    node = nodeModulesTree.get(locationCandidate);
    if (node) {
      if ((node as any).linkType === LinkType.SOFT)
        locationCandidate = (node as any).target;
      lastNode = node;
      request = PortablePath.dot;
      lastNodeLocation = node.dirList ? locationCandidate : (node as any).target;
    } else {
      request = ppath.join(request, curSegment);
    }

    curIdx++;
  }

  request = ppath.join(request, ...segments.slice(lastIdx + 1).map(x => toFilename(x)));

  if (lastNode) {
    if (!lastNode.dirList || request !== PortablePath.dot) {
      result.resolvedPath = ppath.join(lastNodeLocation!, request);
      result.isSymlink = lastNode && (lastNode as any).linkType === LinkType.SOFT && request === PortablePath.dot;
    } else if (request === PortablePath.dot) {
      result.dirList = lastNode.dirList;
      result.forwardedDirPath = npath.toPortablePath(segments.slice(0, firstIdx).join(ppath.sep));
      // If node_modules is inside .zip archive, we use parent folder as a statPath instead
      if (result.forwardedDirPath.endsWith(`.zip`)) {
        result.forwardedDirPath = ppath.dirname(result.forwardedDirPath);
      }
    }
  }

  return result;
};
