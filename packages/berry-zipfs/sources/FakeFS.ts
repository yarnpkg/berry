import {ReadStream, Stats} from 'fs';
import {posix}             from 'path';

export abstract class FakeFS {
  abstract getRealPath(): string;

  resolve(p: string): string {
    return posix.resolve(`/`, p);
  }

  abstract createReadStream(p: string, opts: {encoding?: string}): ReadStream;

  abstract realpathPromise(p: string): Promise<string>;
  abstract realpathSync(p: string): string;

  abstract readdirPromise(p: string): Promise<Array<string>>;
  abstract readdirSync(p: string): Array<string>;

  abstract existsPromise(p: string): Promise<boolean>;
  abstract existsSync(p: string): boolean;

  abstract statPromise(p: string): Promise<Stats>;
  abstract statSync(p: string): Stats;

  abstract lstatPromise(p: string): Promise<Stats>;
  abstract lstatSync(p: string): Stats;

  abstract mkdirPromise(p: string): Promise<void>;
  abstract mkdirSync(p: string): void;

  abstract symlinkPromise(target: string, p: string): Promise<void>;
  abstract symlinkSync(target: string, p: string): void;

  abstract writeFilePromise(p: string, content: Buffer | string): void;
  abstract writeFileSync(p: string, content: Buffer | string): void;

  abstract readFilePromise(p: string, encoding: 'utf8'): Promise<string>;
  abstract readFilePromise(p: string, encoding?: string): Promise<Buffer>;

  abstract readFileSync(p: string, encoding: 'utf8'): string;
  abstract readFileSync(p: string, encoding?: string): Buffer;

  abstract readlinkPromise(p: string): Promise<string>;
  abstract readlinkSync(p: string): string;

  async mkdirpPromise(p: string) {
    p = this.resolve(p);

    if (p === `/`)
      return;

    const parts = p.split(`/`);

    for (let u = 2; u <= parts.length; ++u) {
      const subPath = parts.slice(0, u).join(`/`);

      if (!this.existsSync(subPath)) {
        await this.mkdirPromise(subPath);
      }
    }
  }

  mkdirpSync(p: string) {
    p = this.resolve(p);

    if (p === `/`)
      return;

    const parts = p.split(`/`);

    for (let u = 2; u <= parts.length; ++u) {
      const subPath = parts.slice(0, u).join(`/`);

      if (!this.existsSync(subPath)) {
        this.mkdirSync(subPath);
      }
    }
  }

  async copyPromise(destination: string, source: string, {baseFs = this}: {baseFs?: FakeFS} = {}) {
    const stat = await baseFs.lstatPromise(source);

    if (stat.isDirectory()) {
      await this.mkdirpPromise(destination);
      const directoryListing = await baseFs.readdirPromise(source);
      await Promise.all(directoryListing.map(entry => {
        return this.copyPromise(posix.join(destination, entry), posix.join(source, entry), {baseFs});
      }));
    } else if (stat.isFile()) {
      const content = await baseFs.readFilePromise(source);
      await this.writeFilePromise(destination, content);
    } else {
      throw new Error(`Unsupported file type (mode: 0o${stat.mode.toString(8).padStart(6, `0`)})`);
    }
  }

  copySync(source: string, destination: string, {baseFs = this}: {baseFs?: FakeFS} = {}) {
    const stat = baseFs.lstatSync(source);

    if (stat.isDirectory()) {
      this.mkdirpSync(destination);
      const directoryListing = baseFs.readdirSync(source);
      for (const entry of directoryListing) {
        this.copySync(posix.join(destination, entry), posix.join(source, entry), {baseFs});
      }
    } else if (stat.isFile()) {
      const content = baseFs.readFileSync(source);
      this.writeFileSync(destination, content);
    } else {
      throw new Error(`Unsupported file type (mode: 0o${stat.mode.toString(8).padStart(6, `0`)})`);
    }
  }
};
