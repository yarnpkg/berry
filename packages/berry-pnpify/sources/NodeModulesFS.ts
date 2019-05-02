import { CreateReadStreamOptions, CreateWriteStreamOptions } from '@berry/fslib';
import { NodeFS, PosixFS, FakeFS, WriteFileOptions }         from '@berry/fslib';

import fs                                                    from 'fs';

import { NodePathResolver }                                  from './NodePathResolver';
import { PnPApiLoader }                                      from './PnPApiLoader';
import { PnPApiLocator }                                     from './PnPApiLocator';

export type NodeModulesFSOptions = {
  baseFs?: FakeFS
};

export class NodeModulesFS extends FakeFS {
  private readonly baseFs: FakeFS;
  private readonly pathResolver: NodePathResolver;

  constructor({baseFs = new PosixFS(new NodeFS())}: NodeModulesFSOptions = {}) {
    super();

    this.baseFs = baseFs;
    this.pathResolver = new NodePathResolver({
      apiLoader: new PnPApiLoader({ watch: (fs as any).watch.bind(fs) }),
      apiLocator: new PnPApiLocator({ existsSync: baseFs.existsSync.bind(baseFs) })
    });
  }

  getRealPath() {
    return '/';
  }

  getBaseFs() {
    return this.baseFs;
  }

  private resolveFilePath(p: string): string {
    const pnpPath = this.pathResolver.resolvePath(NodeFS.toPortablePath(p));
    if (!pnpPath.resolvedPath) {
      throw new Error(`ENOENT: no such file or directory, stat '${p}'`)
    } else {
      return pnpPath.resolvedPath;
    }
  }

  private throwIfPathReadonly(p: string): string {
    const portablePath = NodeFS.toPortablePath(p);
    const pnpPath = this.pathResolver.resolvePath(NodeFS.toPortablePath(p));
    if (pnpPath.resolvedPath !== portablePath) {
      throw new Error(`Writing to ${p} is forbidden`);
    } else {
      return p;
    }
  }

  private resolveStatPath(p: string): string {
    const pnpPath = this.pathResolver.resolvePath(NodeFS.toPortablePath(p));
    if (!pnpPath.resolvedPath) {
      throw new Error(`ENOENT: no such file or directory, stat '${p}'`)
    } else {
      return pnpPath.statPath || pnpPath.resolvedPath;
    }
  }

  async openPromise(p: string, flags: string, mode?: number) {
    return await this.baseFs.openPromise(this.resolveFilePath(p), flags, mode);
  }

  openSync(p: string, flags: string, mode?: number) {
    return this.baseFs.openSync(this.resolveFilePath(p), flags, mode);
  }

  async closePromise(fd: number) {
    await this.baseFs.closePromise(fd);
  }

  closeSync(fd: number) {
    this.baseFs.closeSync(fd);
  }

  createReadStream(p: string, opts?: CreateReadStreamOptions) {
    return this.baseFs.createReadStream(this.resolveFilePath(p), opts);
  }

  createWriteStream(p: string, opts?: CreateWriteStreamOptions) {
    return this.baseFs.createWriteStream(this.throwIfPathReadonly(p), opts);
  }

  async realpathPromise(p: string) {
    return await this.baseFs.realpathPromise(this.resolveFilePath(p));
  }

  realpathSync(p: string) {
    return this.baseFs.realpathSync(this.resolveFilePath(p));
  }

  async existsPromise(p: string) {
    const pnpPath = this.pathResolver.resolvePath(NodeFS.toPortablePath(p));
    if (!pnpPath.resolvedPath) {
      return false;
    } else if (pnpPath.statPath) {
      return true;
    } else {
      return await this.baseFs.existsPromise(pnpPath.resolvedPath);
    }
  }

  existsSync(p: string) {
    const pnpPath = this.pathResolver.resolvePath(NodeFS.toPortablePath(p));
    if (!pnpPath.resolvedPath) {
      return false;
    } else if (pnpPath.statPath) {
      return true;
    } else {
      return this.baseFs.existsSync(pnpPath.resolvedPath);
    }
  }

  async accessPromise(p: string, mode?: number) {
    return await this.baseFs.accessPromise(this.resolveStatPath(p), mode);
  }

  accessSync(p: string, mode?: number) {
    return this.baseFs.accessSync(this.resolveStatPath(p), mode);
  }

  async statPromise(p: string) {
    return await this.baseFs.statPromise(this.resolveStatPath(p));
  }

  statSync(p: string) {
    return this.baseFs.statSync(this.resolveStatPath(p));
  }

  async lstatPromise(p: string) {
    return await this.baseFs.lstatPromise(this.resolveStatPath(p));
  }

  lstatSync(p: string) {
    return this.baseFs.lstatSync(this.resolveStatPath(p));
  }

  async chmodPromise(p: string, mask: number) {
    return await this.baseFs.chmodPromise(this.throwIfPathReadonly(p), mask);
  }

  chmodSync(p: string, mask: number) {
    return this.baseFs.chmodSync(this.throwIfPathReadonly(p), mask);
  }

  async renamePromise(oldP: string, newP: string) {
    return await this.baseFs.renamePromise(this.throwIfPathReadonly(oldP), this.throwIfPathReadonly(newP));
  }

  renameSync(oldP: string, newP: string) {
    return this.baseFs.renameSync(this.throwIfPathReadonly(oldP), this.throwIfPathReadonly(newP));
  }

  async copyFilePromise(sourceP: string, destP: string, flags?: number) {
    return await this.baseFs.copyFilePromise(sourceP, this.throwIfPathReadonly(destP), flags);
  }

  copyFileSync(sourceP: string, destP: string, flags?: number) {
    return this.baseFs.copyFileSync(sourceP, this.throwIfPathReadonly(destP), flags);
  }

  async writeFilePromise(p: string, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
    return await this.baseFs.writeFilePromise(this.throwIfPathReadonly(p), content, opts);
  }

  writeFileSync(p: string, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
    return this.baseFs.writeFileSync(this.throwIfPathReadonly(p), content, opts);
  }

  async unlinkPromise(p: string) {
    return await this.baseFs.unlinkPromise(this.throwIfPathReadonly(p));
  }

  unlinkSync(p: string) {
    return this.baseFs.unlinkSync(this.throwIfPathReadonly(p));
  }

  async utimesPromise(p: string, atime: Date | string | number, mtime: Date | string | number) {
    return await this.baseFs.utimesPromise(this.resolveStatPath(p), atime, mtime);
  }

  utimesSync(p: string, atime: Date | string | number, mtime: Date | string | number) {
    return this.baseFs.utimesSync(this.resolveStatPath(p), atime, mtime);
  }

  async mkdirPromise(p: string) {
    return await this.baseFs.mkdirPromise(this.throwIfPathReadonly(p));
  }

  mkdirSync(p: string) {
    return this.baseFs.mkdirSync(this.throwIfPathReadonly(p));
  }

  async rmdirPromise(p: string) {
    return await this.baseFs.rmdirPromise(this.throwIfPathReadonly(p));
  }

  rmdirSync(p: string) {
    return this.baseFs.rmdirSync(this.throwIfPathReadonly(p));
  }

  async symlinkPromise(target: string, p: string) {
    return await this.baseFs.symlinkPromise(this.throwIfPathReadonly(target), p);
  }

  symlinkSync(target: string, p: string) {
    return this.baseFs.symlinkSync(this.throwIfPathReadonly(target), p);
  }

  readFilePromise(p: string, encoding: 'utf8'): Promise<string>;
  readFilePromise(p: string, encoding?: string): Promise<Buffer>;
  async readFilePromise(p: string, encoding?: string) {
    // This weird switch is required to tell TypeScript that the signatures are proper (otherwise it thinks that only the generic one is covered)
    switch (encoding) {
      case `utf8`:
        return await this.baseFs.readFilePromise(this.resolveFilePath(p), encoding);
      default:
        return await this.baseFs.readFilePromise(this.resolveFilePath(p), encoding);
    }
  }

  readFileSync(p: string, encoding: 'utf8'): string;
  readFileSync(p: string, encoding?: string): Buffer;
  readFileSync(p: string, encoding?: string) {
    // This weird switch is required to tell TypeScript that the signatures are proper (otherwise it thinks that only the generic one is covered)
    switch (encoding) {
      case `utf8`:
        return this.baseFs.readFileSync(this.resolveFilePath(p), encoding);
      default:
        return this.baseFs.readFileSync(this.resolveFilePath(p), encoding);
    }
  }

  async readdirPromise(p: string) {
    const pnpPath = this.pathResolver.resolvePath(NodeFS.toPortablePath(p));
    if (!pnpPath.resolvedPath) {
      throw new Error(`ENOENT: no such file or directory, scandir '${p}'`);
    } else if (pnpPath.dirList) {
      return pnpPath.dirList;
    } else {
      return await this.baseFs.readdirPromise(pnpPath.resolvedPath);
    }
  }

  readdirSync(p: string) {
    const pnpPath = this.pathResolver.resolvePath(NodeFS.toPortablePath(p));
    if (!pnpPath.resolvedPath) {
      throw new Error(`ENOENT: no such file or directory, scandir '${p}'`);
    } else if (pnpPath.dirList) {
      return pnpPath.dirList;
    } else {
      return this.baseFs.readdirSync(pnpPath.resolvedPath);
    }
  }

  async readlinkPromise(p: string) {
    return await this.baseFs.readlinkPromise(this.resolveStatPath(p));
  }

  readlinkSync(p: string) {
    return this.baseFs.readlinkSync(this.resolveStatPath(p));
  }
}
