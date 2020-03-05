import fs                                                 from 'fs';
import os, {tmpdir}                                       from 'os';
import {promisify}                                        from 'util';

import {FakeFS}                                           from './FakeFS';
import {NodeFS}                                           from './NodeFS';
import {Filename, PortablePath, NativePath, npath, ppath} from './path';

export {CreateReadStreamOptions}  from './FakeFS';
export {CreateWriteStreamOptions} from './FakeFS';
export {Dirent}                   from './FakeFS';
export {MkdirOptions}             from './FakeFS';
export {WatchOptions}             from './FakeFS';
export {WatchCallback}            from './FakeFS';
export {Watcher}                  from './FakeFS';
export {WriteFileOptions}         from './FakeFS';
export {normalizeLineEndings}     from './FakeFS';
export {ExtractHintOptions}       from './FakeFS';

export {FSPath, Path, PortablePath, NativePath, Filename} from './path';
export {ParsedPath, PathUtils, FormatInputPathObject} from './path';
export {npath, ppath, toFilename} from './path';

export {AliasFS}                  from './AliasFS';
export {FakeFS}                   from './FakeFS';
export {CwdFS}                    from './CwdFS';
export {JailFS}                   from './JailFS';
export {LazyFS}                   from './LazyFS';
export {NoFS}                     from './NoFS';
export {NodeFS}                   from './NodeFS';
export {PosixFS}                  from './PosixFS';
export {ProxiedFS}                from './ProxiedFS';
export {VirtualFS}                from './VirtualFS';
export {ZipFS}                    from './ZipFS';
export {ZipOpenFS}                from './ZipOpenFS';

function getTempName(prefix: string) {
  const tmpdir = npath.toPortablePath(os.tmpdir());
  return ppath.join(tmpdir, `${prefix}${Math.random()}` as Filename);
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
    if (typeof orig === `undefined`)
      return;

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

  setupFn(patchedFs, `exists`, (p: string, ...args: any[]) => {
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

  setupFn(patchedFs, `read`, (p: number, buffer: Buffer, ...args: any[]) => {
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
    const fakeImpl: Function = (fakeFs as any)[fnName].bind(fakeFs);
    const origName = fnName.replace(/Promise$/, ``);

    setupFn(patchedFs, origName, (...args: Array<any>) => {
      const hasCallback = typeof args[args.length - 1] === `function`;
      const callback = hasCallback ? args.pop() : () => {};

      process.nextTick(() => {
        fakeImpl(...args).then((result: any) => {
          callback(null, result);
        }, (error: Error) => {
          callback(error);
        });
      });
    });
  }

  for (const fnName of SYNC_IMPLEMENTATIONS) {
    const fakeImpl: Function = (fakeFs as any)[fnName].bind(fakeFs);
    const origName = fnName;

    setupFn(patchedFs, origName, fakeImpl);
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

const cleanExit = () => {
  for (const p of tmpdirs) {
    try {
      xfs.removeSync(p);
    } catch {
      // Too bad if there's an error
    }

    tmpdirs.delete(p);
  }

  process.off(`exit`, cleanExit);
};

process.on(`exit`, cleanExit);

export const xfs: XFS = Object.assign(new NodeFS(), {
  detachTemp(p: PortablePath) {
    tmpdirs.delete(p);
  },

  mktempSync<T>(this: XFS, cb?: (p: PortablePath) => T) {
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

      if (typeof cb !== `undefined`) {
        try {
          return cb(p);
        } finally {
          if (tmpdirs.has(p)) {
            this.removeSync(p);
          }
        }
      } else {
        tmpdirs.add(p);
        return p;
      }
    }
  },

  async mktempPromise<T>(this: XFS, cb?: (p: PortablePath) => Promise<T>) {
    while (true) {
      const p = getTempName(`xfs-`);

      try {
        this.mkdirPromise(p);
      } catch (error) {
        if (error.code === `EEXIST`) {
          continue;
        } else {
          throw error;
        }
      }

      if (typeof cb !== `undefined`) {
        try {
          return await cb(p);
        } finally {
          if (tmpdirs.has(p)) {
            this.removePromise(p);
          }
        }
      } else {
        tmpdirs.add(p);
        return p;
      }
    }
  },
});
