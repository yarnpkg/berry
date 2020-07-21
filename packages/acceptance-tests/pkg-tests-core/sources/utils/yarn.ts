import {DEFAULT_RC_FILENAME}           from '@yarnpkg/core';
import {PortablePath, ppath, Filename} from '@yarnpkg/fslib';

import * as fsUtils                    from './fs';

export async function readConfiguration(dir: PortablePath, {filename = DEFAULT_RC_FILENAME}: {filename?: Filename} = {}) {
  return await fsUtils.readSyml(ppath.join(dir, filename));
}

export async function writeConfiguration(dir: PortablePath, value: {[key: string]: any}, {filename = DEFAULT_RC_FILENAME}: {filename?: Filename} = {}) {
  return await fsUtils.writeSyml(ppath.join(dir, filename), value);
}

export async function readManifest(dir: PortablePath, {filename = Filename.manifest}: {filename?: Filename} = {}) {
  return await fsUtils.readJson(ppath.join(dir, filename));
}

export function getRelativePluginPath(name: string) {
  return `.yarn/plugins/${name}.cjs` as PortablePath;
}
