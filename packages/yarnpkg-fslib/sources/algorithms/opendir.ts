import {NoParamCallback}     from 'fs';

import {Dir, Dirent, FakeFS} from '../FakeFS';
import * as errors           from '../errors';
import {Filename, Path}      from '../path';

export class CustomDir<P extends Path> implements Dir<P> {
  public nextDirent: () => Dirent | null;

  constructor(
    public readonly path: P,
    public fakeFs: FakeFS<P>,
    public entries: Array<Filename>,
  ) {
    this.nextDirent = () => {
      const filename = entries.shift();
      if (typeof filename === `undefined`)
        return null;

      return Object.assign(fakeFs.statSync(fakeFs.pathUtils.join(path, filename)), {
        name: filename,
      });
    };
  }

  public closed: boolean = false;

  throwIfClosed() {
    if (this.closed) {
      throw errors.ERR_DIR_CLOSED();
    }
  }

  async * [Symbol.asyncIterator]() {
    let dirent: Dirent | null;
    // eslint-disable-next-line no-cond-assign
    while ((dirent = await this.read()) !== null) {
      yield dirent;
    }
  }

  read(): Promise<Dirent>;
  read(cb: (err: NodeJS.ErrnoException | null, dirent: Dirent | null) => void): void;
  read(cb?: (err: NodeJS.ErrnoException | null, dirent: Dirent | null) => void) {
    let dirent: Dirent | null = null;
    let error: NodeJS.ErrnoException | null = null;

    try {
      dirent = this.readSync();
    } catch (e) {
      error = e;
    }

    if (typeof cb !== `undefined`)
      return error !== null ? cb(error, null) : cb(null, dirent);

    return new Promise((resolve, reject) => {
      if (error !== null) {
        reject(error);
      } else {
        resolve(dirent);
      }
    });
  }

  readSync() {
    this.throwIfClosed();

    return this.nextDirent();
  }

  close(): Promise<void>;
  close(cb: NoParamCallback): void;
  close(cb?: NoParamCallback) {
    this.throwIfClosed();
    this.closed = true;

    if (typeof cb !== `undefined`)
      return cb(null);

    return Promise.resolve();
  }

  closeSync() {
    this.throwIfClosed();
    this.closed = true;
  }
}

export function opendir<P extends Path>(path: P, fakeFs: FakeFS<P>, entries: Array<Filename>) {
  return new CustomDir(path, fakeFs, entries);
}
