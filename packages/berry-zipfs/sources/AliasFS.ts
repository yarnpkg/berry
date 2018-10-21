import {posix}  from 'path';

import {FakeFS} from './FakeFS';

export type AliasFSOptions = {
  baseFs: FakeFS,
};

export class AliasFS extends FakeFS {
  private readonly target: string;

  private readonly baseFs: FakeFS;

  constructor(target: string, {baseFs}: AliasFSOptions) {
    super();

    this.target = target;
    this.baseFs = baseFs;
  }

  getRealPath() {
    return this.target;
  }

  createReadStream(p: string, opts: {encoding?: string}) {
    return this.baseFs.createReadStream(p, opts);
  }

  realpath(p: string) {
    return this.baseFs.realpath(p);
  }

  readdir(p: string) {
    return this.baseFs.readdir(p);
  }

  exists(p: string) {
    return this.baseFs.exists(p);
  }

  stat(p: string) {
    return this.baseFs.stat(p);
  }

  lstat(p: string) {
    return this.baseFs.lstat(p);
  }

  mkdir(p: string) {
    return this.baseFs.mkdir(p);
  }

  readlink(p: string) {
    return this.baseFs.readlink(p);
  }

  writeFile(p: string, content: Buffer | string) {
    this.baseFs.writeFile(p, content);
  }

  readFile(p: string, encoding: 'utf8'): string;
  readFile(p: string, encoding?: string): Buffer;
  readFile(p: string, encoding?: string) {
    // This weird switch is required to tell TypeScript that the signatures are proper (otherwise it thinks that only the generic one is covered)
    switch (encoding) {
      case `utf8`:
        return this.baseFs.readFile(p, encoding);
      default:
        return this.baseFs.readFile(p, encoding);
    }
  }
}
