import fs                         from 'fs';
import tmp                        from 'tmp';

import {FakeFS}                   from './FakeFS';
import {NodeFS}                   from './NodeFS';
import {PortablePath, NativePath} from './path';

export {CreateReadStreamOptions}  from './FakeFS';
export {CreateWriteStreamOptions} from './FakeFS';
export {WatchOptions}             from './FakeFS';
export {WatchCallback}            from './FakeFS';
export {Watcher}                  from './FakeFS';
export {WriteFileOptions}         from './FakeFS';

export {FSPath, Path, PortablePath, NativePath, Filename} from './path';
export {ParsedPath, PathUtils, FormatInputPathObject} from './path';
export {npath, ppath, toFilename, fromPortablePath, toPortablePath} from './path';

export {AliasFS}                  from './AliasFS';
export {FakeFS}                   from './FakeFS';
export {CwdFS}                    from './CwdFS';
export {JailFS}                   from './JailFS';
export {LazyFS}                   from './LazyFS';
export {NodeFS}                   from './NodeFS';
export {PosixFS}                  from './PosixFS';
export {ProxiedFS}                from './ProxiedFS';
export {VirtualFS}                from './VirtualFS';
export {ZipFS}                    from './ZipFS';
export {ZipOpenFS}                from './ZipOpenFS';

export function patchFs(patchedFs: typeof fs, fakeFs: FakeFS<NativePath>): void {
  const SYNC_IMPLEMENTATIONS = new Set([
    `accessSync`,
    `appendFileSync`,
    `createReadStream`,
    `chmodSync`,
    `closeSync`,
    `copyFileSync`,
    `lstatSync`,
    `openSync`,
    `readSync`,
    `readlinkSync`,
    `readFileSync`,
    `readdirSync`,
    `readlinkSync`,
    `realpathSync`,
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
    `openPromise`,
    `readdirPromise`,
    `realpathPromise`,
    `readFilePromise`,
    `readdirPromise`,
    `readlinkPromise`,
    `rmdirPromise`,
    `statPromise`,
    `symlinkPromise`,
    `unlinkPromise`,
    `utimesPromise`,
    `writeFilePromise`,
    `writeSync`,
  ]);

  (patchedFs as any).existsSync = (p: string) => {
    try {
      return fakeFs.existsSync(p);
    } catch (error) {
      return false;
    }
  };

  (patchedFs as any).exists = (p: string, ...args: any[]) => {
    const hasCallback = typeof args[args.length - 1] === `function`;
    const callback = hasCallback ? args.pop() : () => {};

    process.nextTick(() => {
      fakeFs.existsPromise(p).then(exists => {
        callback(exists);
      }, () => {
        callback(false);
      });
    });
  };

  (patchedFs as any).read = (p: number, buffer: Buffer, ...args: any[]) => {
    const hasCallback = typeof args[args.length - 1] === `function`;
    const callback = hasCallback ? args.pop() : () => {};

    process.nextTick(() => {
      fakeFs.readPromise(p, buffer, ...args).then(bytesRead => {
        callback(undefined, bytesRead, buffer);
      }, error => {
        callback(error);
      });
    });
  };

  for (const fnName of ASYNC_IMPLEMENTATIONS) {
    const fakeImpl: Function = (fakeFs as any)[fnName].bind(fakeFs);
    const origName = fnName.replace(/Promise$/, ``);

    (patchedFs as any)[origName] = (...args: Array<any>) => {
      const hasCallback = typeof args[args.length - 1] === `function`;
      const callback = hasCallback ? args.pop() : () => {};

      process.nextTick(() => {
        fakeImpl(...args).then((result: any) => {
          callback(undefined, result);
        }, (error: Error) => {
          callback(error);
        });
      });
    };
  }

  for (const fnName of SYNC_IMPLEMENTATIONS) {
    const fakeImpl: Function = (fakeFs as any)[fnName].bind(fakeFs);
    const origName = fnName;

    (patchedFs as any)[origName] = fakeImpl;
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
  mktempSync(): PortablePath;
  mktempSync<T>(cb: (p: PortablePath) => T): T;

  mktempPromise(): Promise<PortablePath>;
  mktempPromise<T>(cb: (p: PortablePath) => Promise<T>): Promise<T>;
};

export const xfs: XFS = Object.assign(new NodeFS(), {
  mktempSync<T>(cb?: (p: PortablePath) => T) {
    const {name, removeCallback} = tmp.dirSync({unsafeCleanup: true});
    if (typeof cb === `undefined`) {
      return NodeFS.toPortablePath(name);
    } else {
      try {
        return cb(NodeFS.toPortablePath(name));
      } finally {
        removeCallback();
      }
    }
  },
  mktempPromise<T>(cb?: (p: PortablePath) => Promise<T>) {
    if (typeof cb === `undefined`) {
      return new Promise<PortablePath>((resolve, reject) => {
        tmp.dir({unsafeCleanup: true}, (err, path) => {
          if (err) {
            reject(err);
          } else {
            resolve(NodeFS.toPortablePath(path));
          }
        });
      });
    } else {
      return new Promise<T>((resolve, reject) => {
        tmp.dir({unsafeCleanup: true}, (err, path, cleanup) => {
          if (err) {
            reject(err);
          } else {
            Promise.resolve(NodeFS.toPortablePath(path)).then(cb).then(result => {
              cleanup();
              resolve(result);
            }, error => {
              cleanup();
              reject(error);
            });
          }
        });
      });
    }
  },
});
