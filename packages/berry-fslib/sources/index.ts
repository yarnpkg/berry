import fs          from 'fs';

import {FakeFS}    from './FakeFS';
import {NodeFS}    from './NodeFS';

export {AliasFS}   from './AliasFS';
export {FakeFS}    from './FakeFS';
export {CwdFS}     from './CwdFS';
export {JailFS}    from './JailFS';
export {NodeFS}    from './NodeFS';
export {PosixFS}   from './PosixFS';
export {ZipFS}     from './ZipFS';
export {ZipOpenFS} from './ZipOpenFS';

function wrapSync(fn: Function) {
  return fn;
}

function wrapAsync(fn: Function) {
  return function (... args: Array<any>) {
    const cb = typeof args[args.length - 1] === `function`
      ? args.pop()
      : null;

    setImmediate(() => {
      let error, result;

      try {
        result = fn(... args);
      } catch (caught) {
        error = caught;
      }

      cb(error, result);
    });
  };
}

export function patchFs(patchedFs: typeof fs, fakeFs: FakeFS): void {
  const SYNC_IMPLEMENTATIONS = new Set([
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

    (patchedFs as any)[origName] = (... args: Array<any>) => {
      const hasCallback = typeof args[args.length - 1] === `function`;
      const callback = hasCallback ? args.pop() : () => {};

      fakeImpl(... args).then((result: any) => {
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

export function extendFs(realFs: typeof fs, fakeFs: FakeFS): typeof fs {
  const patchedFs = Object.create(realFs);

  patchFs(patchedFs, fakeFs);

  return patchedFs;
}

export const xfs = new NodeFS();
