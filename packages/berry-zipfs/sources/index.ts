import fs = require('fs');

import {FakeFS}    from './FakeFS';

export {AliasFS}   from './AliasFS';
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

export function patch(patchedFs: typeof fs, fakeFs: FakeFS): void {
  const SUPPORTED = new Set([
    `exists`,
    `realpath`,
    `readdir`,
    `stat`,
    `lstat`,
    `readlink`,
    `readFile`,
    `writeFile`,
  ]);

  const SUPPORTED_SYNC_ONLY = new Set([
    `createReadStream`,
  ]);

  for (const fnName of SUPPORTED) {
    // @ts-ignore
    const fakeImpl: Function = fakeFs[fnName].bind(fakeFs);

    const asyncName = fnName;
    const syncName = `${fnName}Sync`;

    const asyncOrig: any = (patchedFs as any)[asyncName];
    const syncOrig: any = (patchedFs as any)[syncName];

    if (asyncOrig)
      (patchedFs as any)[asyncName] = wrapAsync(fakeImpl);

    if (syncOrig) {
      (patchedFs as any)[syncName] = wrapSync(fakeImpl);
    }
  }

  for (const fnName of SUPPORTED_SYNC_ONLY) {
    // @ts-ignore
    const fakeImpl: Function = fakeFs[fnName].bind(fakeFs);

    const syncName = fnName;
    const syncOrig: any = (patchedFs as any)[syncName];

    if (syncOrig) {
      (patchedFs as any)[syncName] = wrapSync(fakeImpl);
    }
  }
}

export function extend(realFs: typeof fs, fakeFs: FakeFS): typeof fs {
  const patchedFs = Object.create(realFs);

  patch(patchedFs, fakeFs);

  return patchedFs;
}
