import {NodeFS, PortablePath, ppath, toFilename}  from '@yarnpkg/fslib';
import {PnpApi, LinkType}                         from '@yarnpkg/pnp';

import {HoisterOptions, NodeModulesTree, Hoister} from './Hoister';
import {PathResolver, ResolvedPath}               from './NodePathResolver';

interface HoistedResolverOptions extends HoisterOptions {
}

const NODE_MODULES = 'node_modules';

export class HoistedPathResolver implements PathResolver {
  private readonly nodeModulesTree: NodeModulesTree;

  /**
   * Constructs new instance of Node path resolver
   *
   * @param pnp PnP API instance
   */
  constructor(pnp: PnpApi, options: HoistedResolverOptions = {optimizeSizeOnDisk: false}) {
    this.nodeModulesTree = new Hoister(options).hoist(pnp);
  }

  public resolvePath(nodePath: PortablePath): ResolvedPath {
    const result: ResolvedPath = {resolvedPath: nodePath};
    if (nodePath.indexOf(ppath.sep + NODE_MODULES) < 0)
      return result;
    const segments = nodePath.split(ppath.sep);
    let segCount = 1;
    let seenNodeModules = false;
    let statPath;
    while (segCount <= segments.length) {
      const curPath = NodeFS.toPortablePath(segments.slice(0, segCount).join(ppath.sep) || '/');
      const curNode = this.nodeModulesTree.get(curPath);
      if (!curNode) {
        break;
      } else if (Array.isArray(curNode)) {
        const [location, linkType] = curNode;
        delete result.dirList;
        result.isSymlink = linkType === LinkType.SOFT && segCount === segments.length;
        result.resolvedPath = NodeFS.toPortablePath(ppath.join(location, ...segments.slice(segCount, segments.length).map(x => toFilename(x))));
        break;
      } else if (seenNodeModules && segCount === segments.length) {
        result.dirList = curNode;
        result.statPath = statPath;
        break;
      }
      if (segCount > 0 && segments[segCount - 1] === NODE_MODULES && !seenNodeModules) {
        statPath = ppath.dirname(curPath);
        seenNodeModules = true;
      }
      segCount++;
    }
    return result;
  }
}
