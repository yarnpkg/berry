import fs = require('fs');

import {FakeFS}    from './FakeFS';

export {AliasFS}   from './AliasFS';
export {CwdFS}     from './CwdFS';
export {JailFS}    from './JailFS';
export {NodeFS}    from './NodeFS';
export {FakeFS}    from './FakeFS';
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
    `existsSync`,
    `realpathSync`,
    `readdirSync`,
    `statSync`,
    `lstatSync`,
    `readlinkSync`,
    `readFileSync`,
    `writeFileSync`,
  ]);

  const ASYNC_IMPLEMENTATIONS = new Set([
    `existsPromise`,
    `realpathPromise`,
    `readdirPromise`,
    `statPromise`,
    `lstatPromise`,
    `readlinkPromise`,
    `readFilePromise`,
    `writeFilePromise`,
  ]);

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
}

export function extendFs(realFs: typeof fs, fakeFs: FakeFS): typeof fs {
  const patchedFs = Object.create(realFs);

  patchFs(patchedFs, fakeFs);

  return patchedFs;
}
