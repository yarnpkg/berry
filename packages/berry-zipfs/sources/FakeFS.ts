import {ReadStream, Stats} from 'fs';
import {posix}             from 'path';

export abstract class FakeFS {
  abstract getRealPath(): string;

  abstract createReadStream(p: string, opts: {encoding?: string}): ReadStream;

  abstract realpath(p: string): string;

  abstract readdir(p: string): Array<string>;

  abstract exists(p: string): boolean;

  abstract stat(p: string): Stats;

  abstract lstat(p: string): Stats;

  abstract mkdir(p: string): void;

  abstract readlink(p: string): string;

  abstract writeFile(p: string, content: Buffer | string): void;

  abstract readFile(p: string, encoding: 'utf8'): string;
  abstract readFile(p: string, encoding?: string): Buffer;

  mkdirp(p: string) {
    p = posix.resolve(`/`, p);

    if (p === `/`)
      return;

    const parts = p.split(`/`);

    for (let u = 2; u <= parts.length; ++u) {
      const subPath = parts.slice(0, u).join(`/`);

      if (!this.exists(subPath)) {
        this.mkdir(subPath);
      }
    }
  }
};
