import {patchFs as fslibPatchFs, NodeFS, PosixFS}   from '@berry/fslib';

import fs                                           from 'fs';

import {NodeModulesFS}                              from './NodeModulesFS';

let fsPatched = false;

export const patchFs = () => {
  if (!fsPatched) {
    const localFs: typeof fs = {...fs};
    const baseFs = new PosixFS(new NodeFS(localFs));
    const nodeModulesFS = new NodeModulesFS({baseFs});
    fslibPatchFs(fs, nodeModulesFS);
    fsPatched = true;
  }
}

if (!process.mainModule)
  patchFs();

export {PnPApiLocator} from './PnPApiLocator';
export {NodeModulesFS};
