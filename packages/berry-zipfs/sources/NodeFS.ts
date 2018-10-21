import fs = require('fs');

import {FakeFS} from './FakeFS';

export class NodeFS extends FakeFS {
  private readonly realFs: typeof fs;

  constructor(realFs: typeof fs = fs) {
    super();

    this.realFs = realFs;
  }

  getRealPath() {
    return `/`;
  }

  createReadStream(p: string, opts: {encoding?: string}) {
    return this.realFs.createReadStream(this.fromPortablePath(p), opts);
  }

  realpath(p: string) {
    return this.toPortablePath(this.realFs.realpathSync(this.fromPortablePath(p)));
  }

  readdir(p: string) {
    return this.realFs.readdirSync(this.fromPortablePath(p));
  }

  exists(p: string) {
    return this.realFs.existsSync(this.fromPortablePath(p));
  }

  stat(p: string) {
    return this.realFs.statSync(this.fromPortablePath(p));
  }

  lstat(p: string) {
    return this.realFs.lstatSync(this.fromPortablePath(p));
  }

  mkdir(p: string) {
    return this.realFs.mkdirSync(this.fromPortablePath(p));
  }

  readlink(p: string) {
    return this.realFs.readlinkSync(this.fromPortablePath(p));
  }

  writeFile(p: string, content: Buffer | string) {
    this.realFs.writeFileSync(this.fromPortablePath(p), content);
  }

  readFile(p: string, encoding: 'utf8'): string;
  readFile(p: string, encoding?: string): Buffer;
  readFile(p: string, encoding?: string) {
    return this.realFs.readFileSync(this.fromPortablePath(p), encoding);
  }

  private fromPortablePath(p: string) {
    return p;
  }

  private toPortablePath(p: string) {
    return p;
  }
}
