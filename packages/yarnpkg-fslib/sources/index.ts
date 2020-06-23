import fs                                                 from 'fs';
import os                                                 from 'os';
import {promisify}                                        from 'util';

import {FakeFS}                                           from './FakeFS';
import {NodeFS}                                           from './NodeFS';
import {Filename, PortablePath, NativePath, npath, ppath} from './path';

export {normalizeLineEndings}          from './FakeFS';
export type {CreateReadStreamOptions}  from './FakeFS';
export type {CreateWriteStreamOptions} from './FakeFS';
export type {Dirent, SymlinkType}      from './FakeFS';
export type {MkdirOptions}             from './FakeFS';
export type {WatchOptions}             from './FakeFS';
export type {WatchCallback}            from './FakeFS';
export type {Watcher}                  from './FakeFS';
export type {WriteFileOptions}         from './FakeFS';
export type {ExtractHintOptions}       from './FakeFS';

export {DEFAULT_COMPRESSION_LEVEL}     from './ZipFS';
export type {ZipCompression}           from './ZipFS';

export {PortablePath, Filename}                            from './path';
export type {FSPath, Path, NativePath}                     from './path';
export type {ParsedPath, PathUtils, FormatInputPathObject} from './path';
export {npath, ppath, toFilename}                          from './path';

export {AliasFS}                   from './AliasFS';
export {FakeFS}                    from './FakeFS';
export {CwdFS}                     from './CwdFS';
export {JailFS}                    from './JailFS';
export {LazyFS}                    from './LazyFS';
export {NoFS}                      from './NoFS';
export {NodeFS}                    from './NodeFS';
export {PosixFS}                   from './PosixFS';
export {ProxiedFS}                 from './ProxiedFS';
export {VirtualFS}                 from './VirtualFS';
export {ZipFS}                     from './ZipFS';
export {ZipOpenFS}                 from './ZipOpenFS';

function getTempName(prefix: string) {
  const tmpdir = npath.toPortablePath(os.tmpdir());
  const hash = Math.ceil(Math.random() * 0x100000000).toString(16).padStart(8, `0`);

  return ppath.join(tmpdir, `${prefix}${hash}` as Filename);
}

export function patchFs(patchedFs: typeof fs, fakeFs: FakeFS<NativePath>): void {
  const SYNC_IMPLEMENTATIONS = new Set([
    `accessSync`,
    `appendFileSync`,
    `createReadStream`,
    `chmodSync`,
    `closeSync`,
    `copyFileSync`,
    `lstatSync`,
    `lutimesSync`,
    `mkdirSync`,
    `openSync`,
    `readSync`,
    `readlinkSync`,
    `readFileSync`,
    `readdirSync`,
    `readlinkSync`,
    `realpathSync`,
    `renameSync`,
    `rmdirSync`,
    `statSync`,
    `symlinkSync`,
    `unlinkSync`,
    `utimesSync`,
    `watch`,
    `writeFileSync`,
    `writeSync`,
  ]);

  const ASYNC_IMPLEMENTATIONS = new Set([
    `accessPromise`,
    `appendFilePromise`,
    `chmodPromise`,
    `closePromise`,
    `copyFilePromise`,
    `lstatPromise`,
    `lutimesPromise`,
    `mkdirPromise`,
    `openPromise`,
    `readdirPromise`,
    `realpathPromise`,
    `readFilePromise`,
    `readdirPromise`,
    `readlinkPromise`,
    `renamePromise`,
    `rmdirPromise`,
    `statPromise`,
    `symlinkPromise`,
    `unlinkPromise`,
    `utimesPromise`,
    `writeFilePromise`,
    `writeSync`,
  ]);

  const setupFn = (target: any, name: string, replacement: any) => {
    const orig = target[name];
    target[name] = replacement;

    if (typeof orig[promisify.custom] !== `undefined`) {
      replacement[promisify.custom] = orig[promisify.custom];
    }
  };

  setupFn(patchedFs, `existsSync`, (p: string) => {
    try {
      return fakeFs.existsSync(p);
    } catch (error) {
      return false;
    }
  });

  setupFn(patchedFs, `exists`, (p: string, ...args: Array<any>) => {
    const hasCallback = typeof args[args.length - 1] === `function`;
    const callback = hasCallback ? args.pop() : () => {};

    process.nextTick(() => {
      fakeFs.existsPromise(p).then(exists => {
        callback(exists);
      }, () => {
        callback(false);
      });
    });
  });

  setupFn(patchedFs, `read`, (p: number, buffer: Buffer, ...args: Array<any>) => {
    const hasCallback = typeof args[args.length - 1] === `function`;
    const callback = hasCallback ? args.pop() : () => {};

    process.nextTick(() => {
      fakeFs.readPromise(p, buffer, ...args).then(bytesRead => {
        callback(null, bytesRead, buffer);
      }, error => {
        callback(error);
      });
    });
  });

  for (const fnName of ASYNC_IMPLEMENTATIONS) {
    const origName = fnName.replace(/Promise$/, ``);
    if (typeof (patchedFs as any)[origName] === `undefined`)
      continue;

    const fakeImpl: Function = (fakeFs as any)[fnName];
    if (typeof fakeImpl === `undefined`)
      continue;

    const wrapper = (...args: Array<any>) => {
      const hasCallback = typeof args[args.length - 1] === `function`;
      const callback = hasCallback ? args.pop() : () => {};

      process.nextTick(() => {
        fakeImpl.apply(fakeFs, args).then((result: any) => {
          callback(null, result);
        }, (error: Error) => {
          callback(error);
        });
      });
    };

    setupFn(patchedFs, origName, wrapper);
  }

  for (const fnName of SYNC_IMPLEMENTATIONS) {
    const origName = fnName;
    if (typeof (patchedFs as any)[origName] === `undefined`)
      continue;

    const fakeImpl: Function = (fakeFs as any)[fnName];
    if (typeof fakeImpl === `undefined`)
      continue;

    setupFn(patchedFs, origName, fakeImpl.bind(fakeFs));
  }

  patchedFs.realpathSync.native = patchedFs.realpathSync;
  patchedFs.realpath.native = patchedFs.realpath;
}

export function extendFs(realFs: typeof fs, fakeFs: FakeFS<NativePath>): typeof fs {
  const patchedFs = Object.create(realFs);

  patchFs(patchedFs, fakeFs);

  return patchedFs;
}

export type XFS = NodeFS & {
  detachTemp(p: PortablePath): void;

  mktempSync(): PortablePath;
  mktempSync<T>(cb: (p: PortablePath) => T): T;

  mktempPromise(): Promise<PortablePath>;
  mktempPromise<T>(cb: (p: PortablePath) => Promise<T>): Promise<T>;
};

const tmpdirs = new Set<PortablePath>();

let cleanExitRegistered = false;

function registerCleanExit() {
  if (!cleanExitRegistered)
    cleanExitRegistered = true;
  else
    return;

  const cleanExit = () => {
    process.off(`exit`, cleanExit);

    for (const p of tmpdirs) {
      tmpdirs.delete(p);
      try {
        xfs.removeSync(p);
      } catch {
        // Too bad if there's an error
      }
    }
  };

  process.on(`exit`, cleanExit);
}

export const xfs: XFS = Object.assign(new NodeFS(), {
  detachTemp(p: PortablePath) {
    tmpdirs.delete(p);
  },

  mktempSync<T>(this: XFS, cb?: (p: PortablePath) => T) {
    registerCleanExit();

    while (true) {
      const p = getTempName(`xfs-`);

      try {
        this.mkdirSync(p);
      } catch (error) {
        if (error.code === `EEXIST`) {
          continue;
        } else {
          throw error;
        }
      }

      const realP = this.realpathSync(p);
      tmpdirs.add(realP);

      if (typeof cb !== `undefined`) {
        try {
          return cb(realP);
        } finally {
          if (tmpdirs.has(realP)) {
            tmpdirs.delete(realP);
            try {
              this.removeSync(realP);
            } catch {
              // Too bad if there's an error
            }
          }
        }
      } else {
        return p;
      }
    }
  },

  async mktempPromise<T>(this: XFS, cb?: (p: PortablePath) => Promise<T>) {
    registerCleanExit();

    while (true) {
      const p = getTempName(`xfs-`);

      try {
        await this.mkdirPromise(p);
      } catch (error) {
        if (error.code === `EEXIST`) {
          continue;
        } else {
          throw error;
        }
      }

      const realP = await this.realpathPromise(p);
      tmpdirs.add(realP);

      if (typeof cb !== `undefined`) {
        try {
          return await cb(realP);
        } finally {
          if (tmpdirs.has(realP)) {
            tmpdirs.delete(realP);
            try {
              await this.removePromise(realP);
            } catch {
              // Too bad if there's an error
            }
          }
        }
      } else {
        return realP;
      }
    }
  },
});
