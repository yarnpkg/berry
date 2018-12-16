import fs = require('fs');

import {Stats}  from 'fs';

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

  async realpathPromise(p: string) {
    return await new Promise<string>((resolve, reject) => {
      this.realFs.realpath(p, this.makeCallback(resolve, reject));
    });
  }

  realpathSync(p: string) {
    return this.toPortablePath(this.realFs.realpathSync(this.fromPortablePath(p)));
  }

  async existsPromise(p: string) {
    return await new Promise<boolean>(resolve => {
      this.realFs.exists(p, resolve);
    });
  }

  existsSync(p: string) {
    return this.realFs.existsSync(this.fromPortablePath(p));
  }

  async statPromise(p: string) {
    return await new Promise<Stats>((resolve, reject) => {
      this.realFs.stat(p, this.makeCallback(resolve, reject));
    });
  }

  statSync(p: string) {
    return this.realFs.statSync(this.fromPortablePath(p));
  }

  async lstatPromise(p: string) {
    return await new Promise<Stats>((resolve, reject) => {
      this.realFs.lstat(p, this.makeCallback(resolve, reject));
    });
  }

  lstatSync(p: string) {
    return this.realFs.lstatSync(this.fromPortablePath(p));
  }

  async chmodPromise(p: string, mask: number) {
    return await new Promise<void>((resolve, reject) => {
      this.realFs.chmod(this.fromPortablePath(p), mask, this.makeCallback(resolve, reject));
    });
  }

  chmodSync(p: string, mask: number) {
    return this.realFs.chmodSync(this.fromPortablePath(p), mask);
  }

  async writeFilePromise(p: string, content: Buffer | string) {
    return await new Promise<void>((resolve, reject) => {
      this.realFs.writeFile(p, content, this.makeCallback(resolve, reject));
    });
  }

  writeFileSync(p: string, content: Buffer | string) {
    this.realFs.writeFileSync(this.fromPortablePath(p), content);
  }

  async mkdirPromise(p: string) {
    return await new Promise<void>((resolve, reject) => {
      this.realFs.mkdir(p, this.makeCallback(resolve, reject));
    });
  }

  mkdirSync(p: string) {
    return this.realFs.mkdirSync(this.fromPortablePath(p));
  }

  async symlinkPromise(target: string, p: string) {
    return await new Promise<void>((resolve, reject) => {
      this.realFs.symlink(target, this.fromPortablePath(p), this.makeCallback(resolve, reject));
    });
  }

  symlinkSync(target: string, p: string) {
    return this.realFs.symlinkSync(target, this.fromPortablePath(p));
  }

  readFilePromise(p: string, encoding: 'utf8'): Promise<string>;
  readFilePromise(p: string, encoding?: string): Promise<Buffer>;
  async readFilePromise(p: string, encoding?: string) {
    return await new Promise<any>((resolve, reject) => {
      this.realFs.readFile(this.fromPortablePath(p), encoding, this.makeCallback(resolve, reject));
    });
  }

  readFileSync(p: string, encoding: 'utf8'): string;
  readFileSync(p: string, encoding?: string): Buffer;
  readFileSync(p: string, encoding?: string) {
    return this.realFs.readFileSync(this.fromPortablePath(p), encoding);
  }

  async readdirPromise(p: string) {
    return await new Promise<Array<string>>((resolve, reject) => {
      this.realFs.readdir(p, this.makeCallback(resolve, reject));
    });
  }

  readdirSync(p: string) {
    return this.realFs.readdirSync(this.fromPortablePath(p));
  }

  async readlinkPromise(p: string) {
    return await new Promise<string>((resolve, reject) => {
      this.realFs.readlink(p, this.makeCallback(resolve, reject));
    });
  }

  readlinkSync(p: string) {
    return this.realFs.readlinkSync(this.fromPortablePath(p));
  }

  private makeCallback<T>(resolve: (value?: T) => void, reject: (reject: Error) => void) {
    return (err: Error, result?: T) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    };
  }

  private fromPortablePath(p: string) {
    return p;
  }

  private toPortablePath(p: string) {
    return p;
  }
}
