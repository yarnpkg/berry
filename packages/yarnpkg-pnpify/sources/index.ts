import {patchFs as fslibPatchFs}               from '@yarnpkg/fslib';
import {PnpApi}                                from '@yarnpkg/pnp';

import fs                                      from 'fs';

import {NodeModulesFS}                         from './NodeModulesFS';
import {buildNodeModulesTree, buildLocatorMap} from './buildNodeModulesTree';
import {NodeModulesLocatorMap, getArchivePath} from './buildNodeModulesTree';
import {dynamicRequire}                        from './dynamicRequire';

let fsPatched = false;

let pnp: PnpApi;
try {
  pnp = dynamicRequire(`pnpapi`);
} catch (e) {
}

export const patchFs = () => {
  if (pnp && !fsPatched) {
    const realFs: typeof fs = {...fs};
    const nodeModulesFS = new NodeModulesFS(pnp, {realFs});
    fslibPatchFs(fs, nodeModulesFS);
    fsPatched = true;
  }
};

if (!process.mainModule)
  patchFs();

export type {
  NodeModulesBaseNode,
  NodeModulesPackageNode,
} from './buildNodeModulesTree';

export {
  NodeModulesFS,
  buildNodeModulesTree,
  buildLocatorMap,
  getArchivePath,
};
export type {NodeModulesLocatorMap};

