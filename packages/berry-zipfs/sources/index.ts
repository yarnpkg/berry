import fs = require('fs');

import * as path from 'path';

import {ZipFS}   from './ZipFS';

const ZIPFS_CACHE = Symbol(`ZIPFS_CACHE`);
const ZIPFS_REENTRANT = Symbol(`ZIPFS_REENTRANT`);

function findZip(baseFs: typeof fs, p: string) {
  p = path.resolve(process.cwd(), p);

  let rest = [];
  let nextP = p;

  do {
    p = nextP;
    nextP = path.dirname(p);

    let stat;

    try {
      stat = baseFs.lstatSync(p);
    } catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') {
        return null;
      }
    }

    if (!stat) {
      const component = path.basename(p);
      rest.unshift(component);
    } else {
      if (stat.isSymbolicLink()) {
        nextP = path.resolve(path.dirname(p), baseFs.readlinkSync(p));
        continue;
      } else if (stat.isFile() && path.extname(p) === `.zip`) {
        return {archive: p, rest: path.posix.join('/', ... rest)};
      } else {
        return null;
      }
    }
  } while (nextP !== p);

  return null;
}

function getZip(baseFs: typeof fs, p: string) {
  // @ts-ignore
  baseFs[ZIPFS_CACHE] = baseFs[ZIPFS_CACHE] || {};
  // @ts-ignore
  baseFs[ZIPFS_CACHE][p] = baseFs[ZIPFS_CACHE][p] || new ZipFS(baseFs, p);
  // @ts-ignore
  return baseFs[ZIPFS_CACHE][p];
}

function wrapSync(baseFs: typeof fs, original: any, patch: any) {
  return (p: string, ... args: Array<any>) => {
    // @ts-ignore
    if (baseFs[ZIPFS_REENTRANT])
      return original(p, ... args);

    const zipInfo = findZip(baseFs, p);

    if (!zipInfo)
      return original(p, ... args);

    // @ts-ignore
    baseFs[ZIPFS_REENTRANT] = true;

    try {
      const zip = getZip(baseFs, zipInfo.archive);
      return patch.call(zip, zipInfo.rest, ... args);
    } finally {
      // @ts-ignore
      delete baseFs[ZIPFS_REENTRANT];
    }
  };
}

function wrapAsync(baseFs: typeof fs, original: any, patch: any) {
  type Callback = (... arg: Array<any>) => any;

  return (p: string, ... args: Array<any>) => {
    // @ts-ignore
    if (baseFs[ZIPFS_REENTRANT])
      return original(p, ... args);

    const zipInfo = findZip(baseFs, p);

    if (!zipInfo)
      return original(p, ... args);

    let cb: Callback | null = null;

    if (typeof args[args.length - 1] === 'function')
      cb = (args.pop() as Callback);

    let result: any;
    let error: any;

    // @ts-ignore
    baseFs[ZIPFS_REENTRANT] = true;

    try {
      const zip = getZip(baseFs, zipInfo.archive);
      result = patch.call(zip, zipInfo.rest, ... args);
    } catch (ex) {
      error = ex;
    } finally {
      // @ts-ignore
      delete baseFs[ZIPFS_REENTRANT];
    }

    if (cb) {
      const callable = cb;
      setImmediate(() => {
        callable(error, result);
      });
    }
  };
}

export function patch(patchedFs: typeof fs): void {
  const baseFs = Object.create(patchedFs);

  for (const fnName of ZipFS.SUPPORTED) {
    const fnImpl: Function = (ZipFS.prototype as any)[fnName];

    const asyncName = fnName;
    const syncName = `${fnName}Sync`;

    const asyncOrig: any = (patchedFs as any)[asyncName];
    const syncOrig: any = (patchedFs as any)[syncName];

    if (asyncOrig) {
      (patchedFs as any)[asyncName] = wrapAsync(baseFs, asyncOrig, fnImpl);
      (baseFs as any)[asyncName] = asyncOrig;
    }

    if (syncOrig) {
      (patchedFs as any)[syncName] = wrapSync(baseFs, syncOrig, fnImpl);
      (baseFs as any)[syncName] = syncOrig;
    }
  }

  for (const fnName of ZipFS.SUPPORTED_SYNC_ONLY) {
    const fnImpl: Function = (ZipFS.prototype as any)[fnName];

    const syncName = fnName;
    const syncOrig: any = (patchedFs as any)[syncName];

    if (syncOrig) {
      (patchedFs as any)[syncName] = wrapSync(baseFs, syncOrig, fnImpl);
      (baseFs as any)[syncName] = syncOrig;
    }
  }
}

export function extend(baseFs: typeof fs): typeof fs {
  const newFs = Object.create(baseFs);

  patch(newFs);

  return newFs;
}
