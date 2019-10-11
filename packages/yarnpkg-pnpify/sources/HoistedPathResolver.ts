import {NodeFS, PortablePath, ppath}             from '@yarnpkg/fslib';
import {PnpApi, LinkType}                        from '@yarnpkg/pnp';

import fs                                        from 'fs';

import {HoisterOptions, NodeModulesMap, Hoister} from './Hoister';
import {PathResolver, ResolvedPath}              from './NodePathResolver';

interface HoistedResolverOptions extends HoisterOptions {
}

export class HoistedPathResolver implements PathResolver {
  private readonly nodeModulesMap: NodeModulesMap;

  /**
   * Constructs new instance of Node path resolver
   *
   * @param pnp PnP API instance
   */
  constructor(pnp: PnpApi, options: HoistedResolverOptions = {optimizeSizeOnDisk: false}) {
    this.nodeModulesMap = new Hoister(options).hoist(pnp);
  }

  public resolvePath(nodePath: PortablePath): ResolvedPath {
    const result: ResolvedPath = {resolvedPath: nodePath};
    try {
      const locationObj = this.nodeModulesMap.packageLocations.get(nodePath);
      if (locationObj) {
        const [location, linkType] = locationObj;
        result.resolvedPath = location;
        result.isSymlink = linkType === LinkType.SOFT;
      } else {
        const dirList = this.nodeModulesMap.dirEntries.get(nodePath);
        if (dirList) {
          const idx = nodePath.lastIndexOf(`${ppath.sep}node_modules`);
          const issuer = NodeFS.toPortablePath(nodePath.substring(0, idx));
          result.dirList = dirList;
          result.statPath = this.nodeModulesMap.packageLocations.get(issuer)![0];
        }
      }
      fs.appendFileSync('/tnp/pnpify.log', `${nodePath}->${JSON.stringify(result)}\n`);
    } catch (e) {
      fs.appendFileSync('/tnp/pnpify.log', `${nodePath}\n${e.stack}\n`);
    }
    return result;
  }
}
