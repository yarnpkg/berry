import {readFile}            from 'fs';
import {dirname}             from 'path';
import {promisify}           from 'util';

import {hydrateRuntimeState} from './loader/hydrateRuntimeState';
import {makeApi}             from './loader/makeApi';
import {SerializedState}     from './types';

const readFileP = promisify(readFile);

export async function hydratePnpFile(location: string, {pnpapiResolution}: {pnpapiResolution: string}) {
  const source = await readFileP(location, `utf8`);

  return hydratePnpSource(source, {
    basePath: dirname(location),
    pnpapiResolution,
  });
}

export function hydratePnpSource(source: string, {basePath, pnpapiResolution}: {basePath: string, pnpapiResolution: string}) {
  const data = JSON.parse(source) as SerializedState;

  const runtimeState = hydrateRuntimeState(data, {
    basePath,
  });

  return makeApi(runtimeState, {
    compatibilityMode: true,
    pnpapiResolution,
  });
}
