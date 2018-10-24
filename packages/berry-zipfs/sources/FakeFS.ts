import {ReadStream, Stats} from 'fs';
import {posix}             from 'path';

export abstract class FakeFS {
  abstract getRealPath(): string;

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
    p = posix.resolve(`/`, p);

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
    p = posix.resolve(`/`, p);

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
};
