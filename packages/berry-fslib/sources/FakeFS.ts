import {ReadStream, Stats, WriteStream} from 'fs';
import {posix}                          from 'path';

export type CreateReadStreamOptions = Partial<{
  encoding: string,
}>;

export type CreateWriteStreamOptions = Partial<{
  encoding: string,
}>;

export type WriteFileOptions = Partial<{
  encoding: string,
  mode: number,
  flag: string,
}> | string;

export abstract class FakeFS {
  abstract getRealPath(): string;

  resolve(p: string): string {
    return posix.resolve(`/`, p);
  }

  abstract openPromise(p: string, flags: string, mode?: number): Promise<number>;
  abstract openSync(p: string, flags: string, mode?: number): number;

  abstract closePromise(fd: number): void;
  abstract closeSync(fd: number): void;

  abstract createWriteStream(p: string, opts?: CreateWriteStreamOptions): WriteStream;
  abstract createReadStream(p: string, opts?: CreateReadStreamOptions): ReadStream;

  abstract realpathPromise(p: string): Promise<string>;
  abstract realpathSync(p: string): string;

  abstract readdirPromise(p: string): Promise<Array<string>>;
  abstract readdirSync(p: string): Array<string>;

  abstract existsPromise(p: string): Promise<boolean>;
  abstract existsSync(p: string): boolean;

  abstract accessPromise(p: string, mode?: number): Promise<void>;
  abstract accessSync(p: string, mode?: number): void;

  abstract statPromise(p: string): Promise<Stats>;
  abstract statSync(p: string): Stats;

  abstract lstatPromise(p: string): Promise<Stats>;
  abstract lstatSync(p: string): Stats;

  abstract chmodPromise(p: string, mask: number): Promise<void>;
  abstract chmodSync(p: string, mask: number): void;

  abstract mkdirPromise(p: string): Promise<void>;
  abstract mkdirSync(p: string): void;

  abstract rmdirPromise(p: string): Promise<void>;
  abstract rmdirSync(p: string): void;

  abstract symlinkPromise(target: string, p: string): Promise<void>;
  abstract symlinkSync(target: string, p: string): void;

  abstract renamePromise(oldP: string, newP: string): Promise<void>;
  abstract renameSync(oldP: string, newP: string): void;

  abstract copyFilePromise(sourceP: string, destP: string, flags?: number): Promise<void>;
  abstract copyFileSync(sourceP: string, destP: string, flags?: number): void;

  abstract writeFilePromise(p: string, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions): void;
  abstract writeFileSync(p: string, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions): void;

  abstract unlinkPromise(p: string): Promise<void>;
  abstract unlinkSync(p: string): void;

  abstract utimesPromise(p: string, atime: Date | string | number, mtime: Date | string | number): Promise<void>;
  abstract utimesSync(p: string, atime: Date | string | number, mtime: Date | string | number): void;

  abstract readFilePromise(p: string, encoding: 'utf8'): Promise<string>;
  abstract readFilePromise(p: string, encoding?: string): Promise<Buffer>;

  abstract readFileSync(p: string, encoding: 'utf8'): string;
  abstract readFileSync(p: string, encoding?: string): Buffer;

  abstract readlinkPromise(p: string): Promise<string>;
  abstract readlinkSync(p: string): string;

  async removePromise(p: string) {
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
        await this.removePromise(posix.resolve(p, entry));

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

  removeSync(p: string) {
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
        this.removeSync(posix.resolve(p, entry));
      
      this.rmdirSync(p);
    } else {
      this.unlinkSync(p);
    }
  }

  async mkdirpPromise(p: string, {chmod, utimes}: {chmod?: number, utimes?: [Date | string | number, Date | string | number]} = {}) {
    p = this.resolve(p);
    if (p === `/`)
      return;

    const parts = p.split(`/`);

    for (let u = 2; u <= parts.length; ++u) {
      const subPath = parts.slice(0, u).join(`/`);

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
        }
      }
    }
  }

  mkdirpSync(p: string, {chmod, utimes}: {chmod?: number, utimes?: [Date | string | number, Date | string | number]} = {}) {
    p = this.resolve(p);
    if (p === `/`)
      return;

    const parts = p.split(`/`);

    for (let u = 2; u <= parts.length; ++u) {
      const subPath = parts.slice(0, u).join(`/`);

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
        }
      }
    }
  }

  async copyPromise(destination: string, source: string, {baseFs = this, overwrite = true}: {baseFs?: FakeFS, overwrite?: boolean} = {}) {
    const stat = await baseFs.lstatPromise(source);

    if (stat.isDirectory()) {
      await this.mkdirpPromise(destination);
      const directoryListing = await baseFs.readdirPromise(source);
      await Promise.all(directoryListing.map(entry => {
        return this.copyPromise(posix.join(destination, entry), posix.join(source, entry), {baseFs, overwrite});
      }));
    } else if (stat.isFile()) {
      if (!await this.existsPromise(destination) || overwrite) {
        const content = await baseFs.readFilePromise(source);
        await this.writeFilePromise(destination, content);
      }
    } else {
      throw new Error(`Unsupported file type (file: ${source}, mode: 0o${stat.mode.toString(8).padStart(6, `0`)})`);
    }

    const mode = stat.mode & 0o777;
    await this.chmodPromise(destination, mode);
  }

  copySync(destination: string, source: string, {baseFs = this, overwrite = true}: {baseFs?: FakeFS, overwrite?: boolean} = {}) {
    const stat = baseFs.lstatSync(source);

    if (stat.isDirectory()) {
      this.mkdirpSync(destination);
      const directoryListing = baseFs.readdirSync(source);
      for (const entry of directoryListing) {
        this.copySync(posix.join(destination, entry), posix.join(source, entry), {baseFs, overwrite});
      }
    } else if (stat.isFile()) {
      if (!this.existsSync(destination) || overwrite) {
        const content = baseFs.readFileSync(source);
        this.writeFileSync(destination, content);
      }
    } else {
      throw new Error(`Unsupported file type (file: ${source}, mode: 0o${stat.mode.toString(8).padStart(6, `0`)})`);
    }

    const mode = stat.mode & 0o777;
    this.chmodSync(destination, mode);
  }

  async changeFilePromise(p: string, content: string) {
    try {
      const current = await this.readFilePromise(p, `utf8`);
      if (current === content) {
        return;
      }
    } catch (error) {
      // ignore errors, no big deal
    }

    await this.writeFilePromise(p, content);
  }

  changeFileSync(p: string, content: string) {
    try {
      const current = this.readFileSync(p, `utf8`);
      if (current === content) {
        return;
      }
    } catch (error) {
      // ignore errors, no big deal
    }

    this.writeFileSync(p, content);
  }

  async movePromise(fromP: string, toP: string) {
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

  moveSync(fromP: string, toP: string) {
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

  async lockPromise(affectedPath: string, callback: () => Promise<void>) {
    const lockPath = `${affectedPath}.lock`;

    const interval = 1000 / 60;
    const timeout = Date.now() + 60 * 1000;

    let fd = null;

    while (fd === null) {
      try {
        fd = await this.openPromise(lockPath, `wx`);
      } catch (error) {
        if (error.code === `EEXIST`) {
          if (Date.now() < timeout) {
            await new Promise(resolve => setTimeout(resolve, interval));
          } else {
            throw new Error(`Couldn't acquire a lock in a reasonable time (${timeout / 1000}s)`);
          }
        } else {
          throw error;
        }
      }
    }

    try {
      await callback();
    } finally {
      await this.closePromise(fd);
      await this.unlinkPromise(lockPath);
    }
  }
};
