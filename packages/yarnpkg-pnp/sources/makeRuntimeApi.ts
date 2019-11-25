import {npath, PortablePath, ZipOpenFS} from '@yarnpkg/fslib';
import {FakeFS, NodeFS, VirtualFS}      from '@yarnpkg/fslib';
import fs                               from 'fs';

import {generateSerializedState}        from './generateSerializedState';
import {hydrateRuntimeState}            from './loader/hydrateRuntimeState';
import {makeApi}                        from './loader/makeApi';
import {PnpSettings, PnpApi}            from "./types";

export const makeRuntimeApi = (settings: PnpSettings, basePath: string): PnpApi => {
  const data = generateSerializedState(settings);
  const state = hydrateRuntimeState(data, {basePath});

  const nodeFs = new NodeFS(fs);
  const pnpapiResolution = npath.join(basePath, '.pnp.js');

  let defaultFsLayer: FakeFS<PortablePath> = new ZipOpenFS({baseFs: nodeFs, readOnlyArchives: true});
  for (const virtualRoot of state.virtualRoots)
    defaultFsLayer = new VirtualFS(virtualRoot, {baseFs: defaultFsLayer});

  return makeApi(state, {fakeFs: defaultFsLayer, pnpapiResolution});
};
