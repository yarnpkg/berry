import {DEFAULT_RC_FILENAME, Manifest}      from '@yarnpkg/core';
import {PortablePath, ppath, Filename, xfs} from '@yarnpkg/fslib';

import * as fsUtils                         from './fs';

export async function readConfiguration(dir: PortablePath, {filename = DEFAULT_RC_FILENAME}: {filename?: Filename} = {}) {
  return await fsUtils.readSyml(ppath.join(dir, filename));
}

export async function writeConfiguration(dir: PortablePath, value: {[key: string]: any}, {filename = DEFAULT_RC_FILENAME}: {filename?: Filename} = {}) {
  return await fsUtils.writeSyml(ppath.join(dir, filename), value);
}

export async function readManifest(dir: PortablePath, {key, filename = Filename.manifest}: {key?: keyof Manifest, filename?: Filename} = {}) {
  const data = await fsUtils.readJson(ppath.join(dir, filename));
  return key != null ? data?.[key] : data;
}

export async function writeManifest(dir: PortablePath, value: {[key: string]: any}, {filename = Filename.manifest}: {filename?: Filename} = {}) {
  return await fsUtils.writeJson(ppath.join(dir, filename), value);
}

export async function writePackage(dir: PortablePath, manifest: {[key: string]: any}) {
  await xfs.mkdirPromise(dir, {recursive: true});
  await writeManifest(dir, manifest);
}

export function getPluginPath(dir: PortablePath, name: string) {
  return ppath.join(dir, `.yarn/plugins/${name}.cjs` as PortablePath);
}
