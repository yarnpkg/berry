import fs                         from 'fs';

import {FakeFS}                   from './FakeFS';
import {NodeFS}                   from './NodeFS';
import {NativePath}               from './path';

export {CreateReadStreamOptions}  from './FakeFS';
export {CreateWriteStreamOptions} from './FakeFS';
export {WriteFileOptions}         from './FakeFS';

export {Path, PortablePath, NativePath, Filename} from './path';
export {ParsedPath, PathUtils, FormatInputPathObject} from './path';
export {npath, ppath, toFilename} from './path';

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
    `createReadStream`,
    `chmodSync`,
    `copyFileSync`,
    `lstatSync`,
    `openSync`,
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
    `writeFileSync`,
  ]);

  const ASYNC_IMPLEMENTATIONS = new Set([
    `accessPromise`,
    `chmodPromise`,
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
  ]);

  (patchedFs as any).existsSync = (p: string) => {
    try {
      return fakeFs.existsSync(p);
    } catch (error) {
      return false;
    }
  };

  (patchedFs as any).exists = (p: string, callback?: (result: boolean) => any) => {
    fakeFs.existsPromise(p).then(result => {
      if (callback) {
        callback(result);
      }
    }, () => {
      if (callback) {
        callback(false);
      }
    });
  };

  for (const fnName of ASYNC_IMPLEMENTATIONS) {
    const fakeImpl: Function = (fakeFs as any)[fnName].bind(fakeFs);
    const origName = fnName.replace(/Promise$/, ``);

    (patchedFs as any)[origName] = (...args: Array<any>) => {
      const hasCallback = typeof args[args.length - 1] === `function`;
      const callback = hasCallback ? args.pop() : () => {};

      fakeImpl(...args).then((result: any) => {
        callback(undefined, result);
      }, (error: Error) => {
        callback(error);
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

export const xfs = new NodeFS();
