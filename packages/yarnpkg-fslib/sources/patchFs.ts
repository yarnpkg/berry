import fs           from 'fs';
import {promisify}  from 'util';

import {FakeFS}     from './FakeFS';
import {URLFS}      from './URLFS';
import {NativePath} from './path';

const SYNC_IMPLEMENTATIONS = new Set([
  `accessSync`,
  `appendFileSync`,
  `createReadStream`,
  `createWriteStream`,
  `chmodSync`,
  `chownSync`,
  `closeSync`,
  `copyFileSync`,
  `linkSync`,
  `lstatSync`,
  `fstatSync`,
  `lutimesSync`,
  `mkdirSync`,
  `openSync`,
  `opendirSync`,
  `readlinkSync`,
  `readFileSync`,
  `readdirSync`,
  `readlinkSync`,
  `realpathSync`,
  `renameSync`,
  `rmdirSync`,
  `statSync`,
  `symlinkSync`,
  `truncateSync`,
  `unlinkSync`,
  `unwatchFile`,
  `utimesSync`,
  `watch`,
  `watchFile`,
  `writeFileSync`,
  `writeSync`,
]);

const ASYNC_IMPLEMENTATIONS = new Set([
  `accessPromise`,
  `appendFilePromise`,
  `chmodPromise`,
  `chownPromise`,
  `closePromise`,
  `copyFilePromise`,
  `linkPromise`,
  `fstatPromise`,
  `lstatPromise`,
  `lutimesPromise`,
  `mkdirPromise`,
  `openPromise`,
  `opendirPromise`,
  `readdirPromise`,
  `realpathPromise`,
  `readFilePromise`,
  `readdirPromise`,
  `readlinkPromise`,
  `renamePromise`,
  `rmdirPromise`,
  `statPromise`,
  `symlinkPromise`,
  `truncatePromise`,
  `unlinkPromise`,
  `utimesPromise`,
  `writeFilePromise`,
  `writeSync`,
]);

const FILEHANDLE_IMPLEMENTATIONS = new Set([
  `appendFilePromise`,
  `chmodPromise`,
  `chownPromise`,
  `closePromise`,
  `readPromise`,
  `readFilePromise`,
  `statPromise`,
  `truncatePromise`,
  `utimesPromise`,
  `writePromise`,
  `writeFilePromise`,
]);

//#region readSync types
interface ReadSyncOptions {
  /**
   * @default 0
   */
  offset?: number | undefined;
  /**
   * @default `length of buffer`
   */
  length?: number | undefined;
  /**
   * @default null
   */
  position?: number | null | undefined;
}

type ReadSyncArguments = [
  fd: number,
  buffer: Buffer,
  offset: number,
  length: number,
  position?: number | null,
];

type ReadSyncArgumentsOptions = [
  fd: number,
  buffer: Buffer,
  opts?: ReadSyncOptions,
];
//#endregion

//#region read types
type ReadOptions = ReadSyncOptions & { buffer?: Buffer };

type ReadCallback = (
  err: NodeJS.ErrnoException | null,
  bytesRead: number,
  buffer: Buffer
) => void;

type ReadArguments = [
  fd: number,
  buffer: Buffer,
  offset: number,
  length: number,
  position: number | null | undefined,
  callback: ReadCallback,
];

type ReadArgumentsOptions = [
  fd: number,
  opts: ReadOptions,
  callback: ReadCallback,
];

type ReadArgumentsCallback = [fd: number, callback: ReadCallback];
//#endregion

export function patchFs(patchedFs: typeof fs, fakeFs: FakeFS<NativePath>): void {
  // We wrap the `fakeFs` with a `URLFS` to add support for URL instances
  fakeFs = new URLFS(fakeFs);

  const setupFn = (target: any, name: string, replacement: any) => {
    const orig = target[name];
    target[name] = replacement;

    // Preserve any util.promisify implementations
    if (typeof orig?.[promisify.custom] !== `undefined`) {
      replacement[promisify.custom] = orig[promisify.custom];
    }
  };

  /** Callback implementations */
  {
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

    // Adapted from https://github.com/nodejs/node/blob/e5c1fd7a2a1801fd75bdde23b260488e85453eb2/lib/fs.js#L603-L667
    setupFn(patchedFs, `read`, (...args: ReadArguments | ReadArgumentsOptions | ReadArgumentsCallback) => {
      let [fd, buffer, offset, length, position, callback] = args as ReadArguments;

      if (args.length <= 3) {
        // Assume fs.read(fd, options, callback)
        let options: ReadOptions = {};
        if (args.length < 3) {
          // This is fs.read(fd, callback)
          callback = (args as ReadArgumentsCallback)[1];
        } else {
          // This is fs.read(fd, {}, callback)
          options = (args as ReadArgumentsOptions)[1];
          callback = (args as ReadArgumentsOptions)[2];
        }

        ({
          buffer = Buffer.alloc(16384),
          offset = 0,
          length = buffer.byteLength,
          position,
        } = options);
      }

      if (offset == null)
        offset = 0;

      length |= 0;

      if (length === 0) {
        process.nextTick(() => {
          callback(null, 0, buffer);
        });
        return;
      }

      if (position == null)
        position = -1;

      process.nextTick(() => {
        fakeFs.readPromise(fd, buffer, offset, length, position).then(bytesRead => {
          callback(null, bytesRead, buffer);
        }, error => {
          // https://github.com/nodejs/node/blob/1317252dfe8824fd9cfee125d2aaa94004db2f3b/lib/fs.js#L655-L658
          // Known issue: bytesRead could theoretically be > than 0, but we currently always return 0
          callback(error, 0, buffer);
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

    patchedFs.realpath.native = patchedFs.realpath;
  }

  /** Sync implementations */
  {
    setupFn(patchedFs, `existsSync`, (p: string) => {
      try {
        return fakeFs.existsSync(p);
      } catch (error) {
        return false;
      }
    });

    // Adapted from https://github.com/nodejs/node/blob/e5c1fd7a2a1801fd75bdde23b260488e85453eb2/lib/fs.js#L684-L725
    setupFn(patchedFs, `readSync`, (...args: ReadSyncArguments | ReadSyncArgumentsOptions) => {
      let [fd, buffer, offset, length, position] = args as ReadSyncArguments;

      if (args.length <= 3) {
        // Assume fs.read(fd, buffer, options)
        const options = (args as ReadSyncArgumentsOptions)[2] || {};

        ({offset = 0, length = buffer.byteLength, position} = options);
      }

      if (offset == null)
        offset = 0;

      length |= 0;

      if (length === 0)
        return 0;

      if (position == null)
        position = -1;

      return fakeFs.readSync(fd, buffer, offset, length, position);
    });

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
  }

  /** Promise implementations */
  {
    // `fs.promises` is a getter that returns a reference to require(`fs/promises`),
    // so we can just patch `fs.promises` and both will be updated

    const origEmitWarning = process.emitWarning;
    process.emitWarning = () => {};

    let patchedFsPromises;
    try {
      patchedFsPromises = patchedFs.promises;
    } finally {
      process.emitWarning = origEmitWarning;
    }

    if (typeof patchedFsPromises !== `undefined`) {
      // `fs.promises.exists` doesn't exist

      for (const fnName of ASYNC_IMPLEMENTATIONS) {
        const origName = fnName.replace(/Promise$/, ``);
        if (typeof (patchedFsPromises as any)[origName] === `undefined`)
          continue;

        const fakeImpl: Function = (fakeFs as any)[fnName];
        if (typeof fakeImpl === `undefined`)
          continue;

        // Open is a bit particular with fs.promises: it returns a file handle
        // instance instead of the traditional file descriptor number
        if (fnName === `open`)
          continue;

        setupFn(patchedFsPromises, origName, fakeImpl.bind(fakeFs));
      }

      class FileHandle {
        constructor(public fd: number) {
        }
      }

      for (const fnName of FILEHANDLE_IMPLEMENTATIONS) {
        const origName = fnName.replace(/Promise$/, ``);

        const fakeImpl: Function = (fakeFs as any)[fnName];
        if (typeof fakeImpl === `undefined`)
          continue;

        setupFn(FileHandle.prototype, origName, function (this: FileHandle, ...args: Array<any>) {
          return fakeImpl.call(fakeFs, this.fd, ...args);
        });
      }

      setupFn(patchedFsPromises, `open`, async (...args: Array<any>) => {
        // @ts-expect-error
        const fd = await fakeFs.openPromise(...args);
        return new FileHandle(fd);
      });

      // `fs.promises.realpath` doesn't have a `native` property
    }
  }

  /** util.promisify implementations */
  {
    // Override the promisified version of `fs.read` to return an object as per
    // https://github.com/nodejs/node/blob/dc79f3f37caf6f25b8efee4623bec31e2c20f595/lib/fs.js#L559-L560
    // and
    // https://github.com/nodejs/node/blob/ba684805b6c0eded76e5cd89ee00328ac7a59365/lib/internal/util.js#L293
    // @ts-expect-error
    patchedFs.read[promisify.custom] = async (p: number, buffer: Buffer, ...args: Array<any>) => {
      const res = fakeFs.readPromise(p, buffer, ...args);
      return {bytesRead: await res, buffer};
    };
  }
}

export function extendFs(realFs: typeof fs, fakeFs: FakeFS<NativePath>): typeof fs {
  const patchedFs = Object.create(realFs);

  patchFs(patchedFs, fakeFs);

  return patchedFs;
}
