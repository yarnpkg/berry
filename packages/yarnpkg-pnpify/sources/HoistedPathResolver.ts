import {NodeFS, PortablePath, ppath, toFilename}  from '@yarnpkg/fslib';
import {PnpApi, LinkType}                         from '@yarnpkg/pnp';

import {HoisterOptions, NodeModulesTree, Hoister} from './Hoister';
import {PathResolver, ResolvedPath}               from './NodePathResolver';

interface HoistedResolverOptions extends HoisterOptions {
}

const NODE_MODULES_SUFFIX = '/node_modules';

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
    const node = this.nodeModulesTree.get(NodeFS.toPortablePath(targetPath));
    if (node) {
      if (Array.isArray(node)) {
        const [location, linkType] = node;
        result.isSymlink = linkType === LinkType.SOFT;
        result.resolvedPath = NodeFS.toPortablePath(location + (request ? ppath.sep + request : ''));
      } else if (!request) {
        result.dirList = node;
        result.statPath = NodeFS.toPortablePath(nodePath.substring(0, nodePath.indexOf(NODE_MODULES_SUFFIX)));
      }
    }
    return result;
  }
}
