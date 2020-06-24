import {Dirent as NodeDirent, ReadStream, Stats, WriteStream} from 'fs';
import {EOL}                                                  from 'os';

import {copyPromise}                                          from './algorithms/copyPromise';
import {FSPath, Path, PortablePath, PathUtils, Filename}      from './path';
import {convertPath, ppath}                                   from './path';

export type Dirent = Exclude<NodeDirent, 'name'> & {
  name: Filename,
};

export type CreateReadStreamOptions = Partial<{
  encoding: string,
  fd: number,
}>;

export type CreateWriteStreamOptions = Partial<{
  encoding: string,
  fd: number,
  flags: 'a',
}>;

export type MkdirOptions = Partial<{
  recursive: boolean,
  mode: number,
}>;

export type WriteFileOptions = Partial<{
  encoding: string,
  mode: number,
  flag: string,
}> | string;

export type WatchOptions = Partial<{
  persistent: boolean,
  recursive: boolean,
  encoding: string,
}> | string;

export type ChangeFileOptions = Partial<{
  automaticNewlines: boolean,
}>;

export type WatchCallback = (
  eventType: string,
  filename: string,
) => void;

export type Watcher = {
  on: any,
  close: () => void;
};

export type ExtractHintOptions = {
  relevantExtensions: Set<string>;
}

export type SymlinkType = 'file' | 'dir' | 'junction';

export abstract class FakeFS<P extends Path> {
  static DEFAULT_TIME = 315532800;

  public readonly pathUtils: PathUtils<P>;

  protected constructor(pathUtils: PathUtils<P>) {
    this.pathUtils =  pathUtils;
  }

  abstract getExtractHint(hints: ExtractHintOptions): boolean;

  abstract getRealPath(): P;

  abstract resolve(p: P): P;

  abstract openPromise(p: P, flags: string, mode?: number): Promise<number>;
  abstract openSync(p: P, flags: string, mode?: number): number;

  abstract readPromise(fd: number, buffer: Buffer, offset?: number, length?: number, position?: number | null): Promise<number>;
  abstract readSync(fd: number, buffer: Buffer, offset?: number, length?: number, position?: number | null): number;

  abstract writePromise(fd: number, buffer: Buffer, offset?: number, length?: number, position?: number): Promise<number>;
  abstract writePromise(fd: number, buffer: string, position?: number): Promise<number>;
  abstract writeSync(fd: number, buffer: Buffer, offset?: number, length?: number, position?: number): number;
  abstract writeSync(fd: number, buffer: string, position?: number): number;

  abstract closePromise(fd: number): void;
  abstract closeSync(fd: number): void;

  abstract createWriteStream(p: P | null, opts?: CreateWriteStreamOptions): WriteStream;
  abstract createReadStream(p: P | null, opts?: CreateReadStreamOptions): ReadStream;

  abstract realpathPromise(p: P): Promise<P>;
  abstract realpathSync(p: P): P;

  abstract readdirPromise(p: P): Promise<Array<Filename>>;
  abstract readdirPromise(p: P, opts: {withFileTypes: false}): Promise<Array<Filename>>;
  abstract readdirPromise(p: P, opts: {withFileTypes: true}): Promise<Array<Dirent>>;
  abstract readdirPromise(p: P, opts: {withFileTypes: boolean}): Promise<Array<Filename> | Array<Dirent>>;

  abstract readdirSync(p: P): Array<Filename>;
  abstract readdirSync(p: P, opts: {withFileTypes: false}): Array<Filename>;
  abstract readdirSync(p: P, opts: {withFileTypes: true}): Array<Dirent>;
  abstract readdirSync(p: P, opts: {withFileTypes: boolean}): Array<Filename> | Array<Dirent>;

  abstract existsPromise(p: P): Promise<boolean>;
  abstract existsSync(p: P): boolean;

  abstract accessPromise(p: P, mode?: number): Promise<void>;
  abstract accessSync(p: P, mode?: number): void;

  abstract statPromise(p: P): Promise<Stats>;
  abstract statSync(p: P): Stats;

  abstract lstatPromise(p: P): Promise<Stats>;
  abstract lstatSync(p: P): Stats;

  abstract chmodPromise(p: P, mask: number): Promise<void>;
  abstract chmodSync(p: P, mask: number): void;

  abstract mkdirPromise(p: P, opts?: MkdirOptions): Promise<void>;
  abstract mkdirSync(p: P, opts?: MkdirOptions): void;

  abstract rmdirPromise(p: P): Promise<void>;
  abstract rmdirSync(p: P): void;

  abstract symlinkPromise(target: P, p: P, type?: SymlinkType): Promise<void>;
  abstract symlinkSync(target: P, p: P, type?: SymlinkType): void;

  abstract renamePromise(oldP: P, newP: P): Promise<void>;
  abstract renameSync(oldP: P, newP: P): void;

  abstract copyFilePromise(sourceP: P, destP: P, flags?: number): Promise<void>;
  abstract copyFileSync(sourceP: P, destP: P, flags?: number): void;

  abstract appendFilePromise(p: FSPath<P>, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions): void;
  abstract appendFileSync(p: FSPath<P>, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions): void;

  abstract writeFilePromise(p: FSPath<P>, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions): void;
  abstract writeFileSync(p: FSPath<P>, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions): void;

  abstract unlinkPromise(p: P): Promise<void>;
  abstract unlinkSync(p: P): void;

  abstract utimesPromise(p: P, atime: Date | string | number, mtime: Date | string | number): Promise<void>;
  abstract utimesSync(p: P, atime: Date | string | number, mtime: Date | string | number): void;

  lutimesPromise?(p: P, atime: Date | string | number, mtime: Date | string | number): Promise<void>;
  lutimesSync?(p: P, atime: Date | string | number, mtime: Date | string | number): void;

  abstract readFilePromise(p: FSPath<P>, encoding: 'utf8'): Promise<string>;
  abstract readFilePromise(p: FSPath<P>, encoding?: string): Promise<Buffer>;

  abstract readFileSync(p: FSPath<P>, encoding: 'utf8'): string;
  abstract readFileSync(p: FSPath<P>, encoding?: string): Buffer;

  abstract readlinkPromise(p: P): Promise<P>;
  abstract readlinkSync(p: P): P;

  abstract watch(p: P, cb?: WatchCallback): Watcher;
  abstract watch(p: P, opts: WatchOptions, cb?: WatchCallback): Watcher;

  async removePromise(p: P) {
    let stat;
    try {
      stat = await this.lstatPromise(p);
    } catch (error) {
      if (error.code === `ENOENT`) {
        return;
      } else {
        throw error;
      }
    }

    if (stat.isDirectory()) {
      for (const entry of await this.readdirPromise(p))
        await this.removePromise(this.pathUtils.resolve(p, entry));

      // 5 gives 1s worth of retries at worst
      for (let t = 0; t < 5; ++t) {
        try {
          await this.rmdirPromise(p);
          break;
        } catch (error) {
          if (error.code === `EBUSY` || error.code === `ENOTEMPTY`) {
            await new Promise(resolve => setTimeout(resolve, t * 100));
            continue;
          } else {
            throw error;
          }
        }
      }
    } else {
      await this.unlinkPromise(p);
    }
  }

  removeSync(p: P) {
    let stat;
    try {
      stat = this.lstatSync(p);
    } catch (error) {
      if (error.code === `ENOENT`) {
        return;
      } else {
        throw error;
      }
    }

    if (stat.isDirectory()) {
      for (const entry of this.readdirSync(p))
        this.removeSync(this.pathUtils.resolve(p, entry));

      this.rmdirSync(p);
    } else {
      this.unlinkSync(p);
    }
  }

  async mkdirpPromise(p: P, {chmod, utimes}: {chmod?: number, utimes?: [Date | string | number, Date | string | number]} = {}) {
    p = this.resolve(p);
    if (p === this.pathUtils.dirname(p))
      return;

    const parts = p.split(this.pathUtils.sep);

    for (let u = 2; u <= parts.length; ++u) {
      const subPath = parts.slice(0, u).join(this.pathUtils.sep) as P;

      if (!this.existsSync(subPath)) {
        try {
          await this.mkdirPromise(subPath);
        } catch (error) {
          if (error.code === `EEXIST`) {
            continue;
          } else {
            throw error;
          }
        }

        if (chmod != null)
          await this.chmodPromise(subPath, chmod);

        if (utimes != null) {
          await this.utimesPromise(subPath, utimes[0], utimes[1]);
        } else {
          const parentStat = await this.statPromise(this.pathUtils.dirname(subPath));
          await this.utimesPromise(subPath, parentStat.atime, parentStat.mtime);
        }
      }
    }
  }

  mkdirpSync(p: P, {chmod, utimes}: {chmod?: number, utimes?: [Date | string | number, Date | string | number]} = {}) {
    p = this.resolve(p);
    if (p === this.pathUtils.dirname(p))
      return;

    const parts = p.split(this.pathUtils.sep);

    for (let u = 2; u <= parts.length; ++u) {
      const subPath = parts.slice(0, u).join(this.pathUtils.sep) as P;

      if (!this.existsSync(subPath)) {
        try {
          this.mkdirSync(subPath);
        } catch (error) {
          if (error.code === `EEXIST`) {
            continue;
          } else {
            throw error;
          }
        }

        if (chmod != null)
          this.chmodSync(subPath, chmod);

        if (utimes != null) {
          this.utimesSync(subPath, utimes[0], utimes[1]);
        } else {
          const parentStat = this.statSync(this.pathUtils.dirname(subPath));
          this.utimesSync(subPath, parentStat.atime, parentStat.mtime);
        }
      }
    }
  }

  copyPromise(destination: P, source: P, options?: {baseFs?: undefined, overwrite?: boolean, stableSort?: boolean, stableTime?: boolean}): Promise<void>;
  copyPromise<P2 extends Path>(destination: P, source: P2, options: {baseFs: FakeFS<P2>, overwrite?: boolean, stableSort?: boolean, stableTime?: boolean}): Promise<void>;
  async copyPromise<P2 extends Path>(destination: P, source: P2, {baseFs = this as any, overwrite = true, stableSort = false, stableTime = false}: {baseFs?: FakeFS<P2>, overwrite?: boolean, stableSort?: boolean, stableTime?: boolean} = {}) {
    return await copyPromise(this, destination, baseFs, source, {overwrite, stableSort, stableTime});
  }

  /** @deprecated Prefer using `copyPromise` instead */
  copySync(destination: P, source: P, options?: {baseFs?: undefined, overwrite?: boolean}): void;
  copySync<P2 extends Path>(destination: P, source: P2, options: {baseFs: FakeFS<P2>, overwrite?: boolean}): void;
  copySync<P2 extends Path>(destination: P, source: P2, {baseFs = this as any, overwrite = true}: {baseFs?: FakeFS<P2>, overwrite?: boolean} = {}) {
    const stat = baseFs.lstatSync(source);
    const exists = this.existsSync(destination);

    if (stat.isDirectory()) {
      this.mkdirpSync(destination);
      const directoryListing = baseFs.readdirSync(source);
      for (const entry of directoryListing) {
        this.copySync(this.pathUtils.join(destination, entry), baseFs.pathUtils.join(source, entry), {baseFs, overwrite});
      }
    } else if (stat.isFile()) {
      if (!exists || overwrite) {
        if (exists)
          this.removeSync(destination);

        const content = baseFs.readFileSync(source);
        this.writeFileSync(destination, content);
      }
    } else if (stat.isSymbolicLink()) {
      if (!exists || overwrite) {
        if (exists)
          this.removeSync(destination);

        const target = baseFs.readlinkSync(source);
        this.symlinkSync(convertPath(this.pathUtils, target), destination);
      }
    } else {
      throw new Error(`Unsupported file type (file: ${source}, mode: 0o${stat.mode.toString(8).padStart(6, `0`)})`);
    }

    const mode = stat.mode & 0o777;
    this.chmodSync(destination, mode);
  }

  async changeFilePromise(p: P, content: string, {automaticNewlines}: ChangeFileOptions = {}) {
    let current = ``;
    try {
      current = await this.readFilePromise(p, `utf8`);
    } catch (error) {
      // ignore errors, no big deal
    }

    const normalizedContent = automaticNewlines
      ? normalizeLineEndings(current, content)
      : content;

    if (current === normalizedContent)
      return;

    await this.writeFilePromise(p, normalizedContent);
  }

  changeFileSync(p: P, content: string, {automaticNewlines = false}: ChangeFileOptions = {}) {
    let current = ``;
    try {
      current = this.readFileSync(p, `utf8`);
    } catch (error) {
      // ignore errors, no big deal
    }

    const normalizedContent = automaticNewlines
      ? normalizeLineEndings(current, content)
      : content;

    if (current === normalizedContent)
      return;

    this.writeFileSync(p, normalizedContent);
  }

  async movePromise(fromP: P, toP: P) {
    try {
      await this.renamePromise(fromP, toP);
    } catch (error) {
      if (error.code === `EXDEV`) {
        await this.copyPromise(toP, fromP);
        await this.removePromise(fromP);
      } else {
        throw error;
      }
    }
  }

  moveSync(fromP: P, toP: P) {
    try {
      this.renameSync(fromP, toP);
    } catch (error) {
      if (error.code === `EXDEV`) {
        this.copySync(toP, fromP);
        this.removeSync(fromP);
      } else {
        throw error;
      }
    }
  }

  async lockPromise<T>(affectedPath: P, callback: () => Promise<T>): Promise<T> {
    const lockPath = `${affectedPath}.flock` as P;

    const interval = 1000 / 60;
    const startTime = Date.now();

    let fd = null;

    // Even when we detect that a lock file exists, we still look inside to see
    // whether the pid that created it is still alive. It's not foolproof
    // (there are false positive), but there are no false negative and that's
    // all that matters in 99% of the cases.
    const isAlive = async () => {
      let pid: number;

      try {
        ([pid] = await this.readJsonPromise(lockPath));
      } catch (error) {
        // If we can't read the file repeatedly, we assume the process was
        // aborted before even writing finishing writing the payload.
        return Date.now() - startTime < 500;
      }

      try {
        // "As a special case, a signal of 0 can be used to test for the
        // existence of a process" - so we check whether it's alive.
        process.kill(pid, 0);
        return true;
      } catch (error) {
        return false;
      }
    };

    while (fd === null) {
      try {
        fd = await this.openPromise(lockPath, `wx`);
      } catch (error) {
        if (error.code === `EEXIST`) {
          if (!await isAlive()) {
            try {
              await this.unlinkPromise(lockPath);
              continue;
            } catch (error) {
              // No big deal if we can't remove it. Just fallback to wait for
              // it to be eventually released by its owner.
            }
          }
          if (Date.now() - startTime < 60 * 1000) {
            await new Promise(resolve => setTimeout(resolve, interval));
          } else {
            throw new Error(`Couldn't acquire a lock in a reasonable time (via ${lockPath})`);
          }
        } else {
          throw error;
        }
      }
    }

    await this.writePromise(fd, JSON.stringify([process.pid]));

    try {
      return await callback();
    } finally {
      try {
        await this.unlinkPromise(lockPath);
        await this.closePromise(fd);
      } catch (error) {
        // noop
      }
    }
  }

  async readJsonPromise(p: P) {
    const content = await this.readFilePromise(p, `utf8`);

    try {
      return JSON.parse(content);
    } catch (error) {
      error.message += ` (in ${p})`;
      throw error;
    }
  }

  async readJsonSync(p: P) {
    const content = this.readFileSync(p, `utf8`);

    try {
      return JSON.parse(content);
    } catch (error) {
      error.message += ` (in ${p})`;
      throw error;
    }
  }

  async writeJsonPromise(p: P, data: any) {
    return await this.writeFilePromise(p, `${JSON.stringify(data, null, 2)}\n`);
  }

  writeJsonSync(p: P, data: any) {
    return this.writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`);
  }

  async preserveTimePromise(p: P, cb: () => Promise<P | void>) {
    const stat = await this.lstatPromise(p);

    const result = await cb();
    if (typeof result !== `undefined`)
      p = result;

    if (this.lutimesPromise) {
      await this.lutimesPromise(p, stat.atime, stat.mtime);
    } else if (!stat.isSymbolicLink()) {
      await this.utimesPromise(p, stat.atime, stat.mtime);
    }
  }

  async preserveTimeSync(p: P, cb: () => P | void) {
    const stat = this.lstatSync(p);

    const result = cb();
    if (typeof result !== `undefined`)
      p = result;

    if (this.lutimesSync) {
      this.lutimesSync(p, stat.atime, stat.mtime);
    } else if (!stat.isSymbolicLink()) {
      this.utimesSync(p, stat.atime, stat.mtime);
    }
  }
}

export abstract class BasePortableFakeFS extends FakeFS<PortablePath> {
  protected constructor() {
    super(ppath);
  }
}

function getEndOfLine(content: string) {
  const matches = content.match(/\r?\n/g);
  if (matches === null)
    return EOL;

  const crlf = matches.filter(nl => nl === `\r\n`).length;
  const lf = matches.length - crlf;

  return crlf > lf ? `\r\n` : `\n`;
}

export function normalizeLineEndings(originalContent: string, newContent: string) {
  return newContent.replace(/\r?\n/g, getEndOfLine(originalContent));
}
