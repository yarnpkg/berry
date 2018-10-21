import {posix}  from 'path';

import {FakeFS} from './FakeFS';
import {NodeFS} from './NodeFS';

export type JailFSOptions = {
  baseFs?: FakeFS,
};

export class JailFS extends FakeFS {
  private readonly target: string;

  private readonly baseFs: FakeFS;

  constructor(target: string, {baseFs = new NodeFS()}: JailFSOptions = {}) {
    super();

    this.target = target;
    this.baseFs = baseFs;
  }

  getRealPath() {
    return posix.resolve(this.baseFs.getRealPath(), posix.relative(`/`, this.target));
  }

  createReadStream(p: string, opts: {encoding?: string}) {
    return this.baseFs.createReadStream(this.fromJailedPath(p), opts);
  }

  realpath(p: string) {
    return this.toJailedPath(this.baseFs.realpath(this.fromJailedPath(p)));
  }

  readdir(p: string) {
    return this.baseFs.readdir(this.fromJailedPath(p));
  }

  exists(p: string) {
    return this.baseFs.exists(this.fromJailedPath(p));
  }

  stat(p: string) {
    return this.baseFs.stat(this.fromJailedPath(p));
  }

  lstat(p: string) {
    return this.baseFs.lstat(this.fromJailedPath(p));
  }

  mkdir(p: string) {
    return this.baseFs.mkdir(this.fromJailedPath(p));
  }

  readlink(p: string) {
    return this.baseFs.readlink(this.fromJailedPath(p));
  }

  writeFile(p: string, content: Buffer | string) {
    this.baseFs.writeFile(this.fromJailedPath(p), content);
  }

  readFile(p: string, encoding: 'utf8'): string;
  readFile(p: string, encoding?: string): Buffer;
  readFile(p: string, encoding?: string) {
    // This weird switch is required to tell TypeScript that the signatures are proper (otherwise it thinks that only the generic one is covered)
    switch (encoding) {
      case `utf8`:
        return this.baseFs.readFile(this.fromJailedPath(p), encoding);
      default:
        return this.baseFs.readFile(this.fromJailedPath(p), encoding);
    }
  }

  private fromJailedPath(p: string) {
    return posix.resolve(this.target, posix.relative(`/`, posix.resolve(`/`, p)));
  }

  private toJailedPath(p: string) {
    const relative = posix.relative(this.target, posix.normalize(p));

    if (relative.match(/^(\.\.)?\//))
      throw new Error(`Resolving this path (${p}) would escape the jail (${this.target})`);

    return posix.resolve(`/`, relative);
  }
}
