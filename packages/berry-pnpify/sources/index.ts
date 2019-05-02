import { patchFs, NodeFS, PosixFS } from '@berry/fslib';

import fs                           from 'fs';

import { NodeModulesFS }            from './NodeModulesFS';

const localFs: typeof fs = {...fs};
const baseFs = new PosixFS(new NodeFS(localFs));
const nodeModulesFS = new NodeModulesFS({ baseFs });
patchFs(fs, nodeModulesFS);

