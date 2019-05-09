import {CreateReadStreamOptions, CreateWriteStreamOptions}   from '@berry/fslib';
import {NodeFS, PosixFS, FakeFS, WriteFileOptions}           from '@berry/fslib';

import fs                                                    from 'fs';
import path                                                  from 'path';

import {NodePathResolver, ResolvedPath}                      from './NodePathResolver';
import {PnPApiLoader}                                        from './PnPApiLoader';
import {PnPApiLocator}                                       from './PnPApiLocator';

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
      apiLoader: new PnPApiLoader({watch: (fs as any).watch.bind(fs)}),
      apiLocator: new PnPApiLocator({existsSync: baseFs.existsSync.bind(baseFs)}),
    });
  }

  getRealPath() {
    return '/';
  }

  getBaseFs() {
    return this.baseFs;
  }

  private resolvePath(p: string): ResolvedPath & { fullOriginalPath: string } {
    const fullOriginalPath = path.resolve(p);
    return {...this.pathResolver.resolvePath(fullOriginalPath), fullOriginalPath};
  }

  private resolveFilePath(p: string): string {
    const pnpPath = this.resolvePath(p);
    if (!pnpPath.resolvedPath) {
      throw NodeModulesFS.createFsError('ENOENT', `no such file or directory, stat '${p}'`);
    } else {
      return pnpPath.resolvedPath;
    }
  }

  private resolveLink(p: string, op: string, onSymlink: (stats: fs.Stats, targetPath: string) => any, onRealPath: () => any) {
    const pnpPath = this.resolvePath(p);
    if (!pnpPath.resolvedPath) {
      throw NodeModulesFS.createFsError('ENOENT', `no such file or directory, ${op} '${p}'`);
    } else {
      if (pnpPath.resolvedPath !== pnpPath.fullOriginalPath) {
        try {
          const stats = this.baseFs.lstatSync(pnpPath.statPath || pnpPath.resolvedPath);
          if (stats.isDirectory()) {
            throw NodeModulesFS.createFsError('EINVAL', `invalid argument, ${op} '${p}'`);
          } else {
            return onSymlink(stats, path.relative(path.dirname(pnpPath.fullOriginalPath), pnpPath.statPath || pnpPath.resolvedPath));
          }
        } catch (e) {
        }
      }
    }
    return onRealPath();
  }

  private static makeSymlinkStats(stats: fs.Stats): fs.Stats {
    return Object.assign(stats, {
      isFile: () => false,
      isDirectory: () => false,
      isSymbolicLink: () => true,
    });
  }

  private static createFsError(code: string, message: string) {
    return Object.assign(new Error(`${code}: ${message}`), {code});
  }

  private throwIfPathReadonly(op: string, p: string): string {
    const pnpPath = this.resolvePath(p);
    if (pnpPath.resolvedPath !== pnpPath.fullOriginalPath) {
      throw NodeModulesFS.createFsError('EPERM', `operation not permitted, ${op} '${p}'`);
    } else {
      return p;
    }
  }

  private resolveDirOrFilePath(p: string): string {
    const pnpPath = this.resolvePath(p);
    if (!pnpPath.resolvedPath) {
      throw NodeModulesFS.createFsError('ENOENT', `no such file or directory, stat '${p}'`);
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
    return this.baseFs.createWriteStream(this.throwIfPathReadonly('createWriteStream', p), opts);
  }

  async realpathPromise(p: string) {
    return await this.baseFs.realpathPromise(this.resolveFilePath(p));
  }

  realpathSync(p: string) {
    return this.baseFs.realpathSync(this.resolveFilePath(p));
  }

  async existsPromise(p: string) {
    const pnpPath = this.resolvePath(p);
    if (!pnpPath.resolvedPath) {
      return false;
    } else if (pnpPath.statPath) {
      return true;
    } else {
      return await this.baseFs.existsPromise(pnpPath.resolvedPath);
    }
  }

  existsSync(p: string) {
    const pnpPath = this.resolvePath(p);
    if (!pnpPath.resolvedPath) {
      return false;
    } else if (pnpPath.statPath) {
      return true;
    } else {
      return this.baseFs.existsSync(pnpPath.resolvedPath);
    }
  }

  async accessPromise(p: string, mode?: number) {
    return await this.baseFs.accessPromise(this.resolveDirOrFilePath(p), mode);
  }

  accessSync(p: string, mode?: number) {
    return this.baseFs.accessSync(this.resolveDirOrFilePath(p), mode);
  }

  async statPromise(p: string) {
    return await this.baseFs.statPromise(this.resolveDirOrFilePath(p));
  }

  statSync(p: string) {
    return this.baseFs.statSync(this.resolveDirOrFilePath(p));
  }

  async lstatPromise(p: string) {
    return this.resolveLink(p, 'lstat',
      (stats) => NodeModulesFS.makeSymlinkStats(stats),
      async () => await this.baseFs.lstatPromise(p)
    );
  }

  lstatSync(p: string) {
    return this.resolveLink(p, 'lstat',
      (stats) => NodeModulesFS.makeSymlinkStats(stats),
      () => this.baseFs.lstatSync(p)
    );
  }

  async chmodPromise(p: string, mask: number) {
    return await this.baseFs.chmodPromise(this.throwIfPathReadonly('chmod', p), mask);
  }

  chmodSync(p: string, mask: number) {
    return this.baseFs.chmodSync(this.throwIfPathReadonly('chmodSync', p), mask);
  }

  async renamePromise(oldP: string, newP: string) {
    return await this.baseFs.renamePromise(this.throwIfPathReadonly('rename', oldP), this.throwIfPathReadonly('rename', newP));
  }

  renameSync(oldP: string, newP: string) {
    return this.baseFs.renameSync(this.throwIfPathReadonly('renameSync', oldP), this.throwIfPathReadonly('renameSync', newP));
  }

  async copyFilePromise(sourceP: string, destP: string, flags?: number) {
    return await this.baseFs.copyFilePromise(this.resolveFilePath(sourceP), this.throwIfPathReadonly('copyFile', destP), flags);
  }

  copyFileSync(sourceP: string, destP: string, flags?: number) {
    return this.baseFs.copyFileSync(this.resolveFilePath(sourceP), this.throwIfPathReadonly('copyFileSync', destP), flags);
  }

  async writeFilePromise(p: string, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
    return await this.baseFs.writeFilePromise(this.throwIfPathReadonly('writeFile', p), content, opts);
  }

  writeFileSync(p: string, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
    return this.baseFs.writeFileSync(this.throwIfPathReadonly('writeFileSync', p), content, opts);
  }

  async unlinkPromise(p: string) {
    return await this.baseFs.unlinkPromise(this.throwIfPathReadonly('unlink', p));
  }

  unlinkSync(p: string) {
    return this.baseFs.unlinkSync(this.throwIfPathReadonly('unlinkSync', p));
  }

  async utimesPromise(p: string, atime: Date | string | number, mtime: Date | string | number) {
    return await this.baseFs.utimesPromise(this.resolveDirOrFilePath(p), atime, mtime);
  }

  utimesSync(p: string, atime: Date | string | number, mtime: Date | string | number) {
    return this.baseFs.utimesSync(this.resolveDirOrFilePath(p), atime, mtime);
  }

  async mkdirPromise(p: string) {
    return await this.baseFs.mkdirPromise(this.throwIfPathReadonly('mkdir', p));
  }

  mkdirSync(p: string) {
    return this.baseFs.mkdirSync(this.throwIfPathReadonly('mkdirSync', p));
  }

  async rmdirPromise(p: string) {
    return await this.baseFs.rmdirPromise(this.throwIfPathReadonly('rmdir', p));
  }

  rmdirSync(p: string) {
    return this.baseFs.rmdirSync(this.throwIfPathReadonly('rmdirSync', p));
  }

  async symlinkPromise(target: string, p: string) {
    return await this.baseFs.symlinkPromise(this.resolveDirOrFilePath(target), this.throwIfPathReadonly('symlink', p));
  }

  symlinkSync(target: string, p: string) {
    return this.baseFs.symlinkSync(this.resolveDirOrFilePath(target), this.throwIfPathReadonly('symlinkSync', p));
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
    const pnpPath = this.resolvePath(p);
    if (!pnpPath.resolvedPath) {
      throw NodeModulesFS.createFsError('ENOENT', `no such file or directory, scandir '${p}'`);
    } else if (pnpPath.dirList) {
      return pnpPath.dirList;
    } else {
      return await this.baseFs.readdirPromise(pnpPath.resolvedPath);
    }
  }

  readdirSync(p: string) {
    const pnpPath = this.resolvePath(p);
    if (!pnpPath.resolvedPath) {
      throw NodeModulesFS.createFsError('ENOENT', `no such file or directory, scandir '${p}'`);
    } else if (pnpPath.dirList) {
      return pnpPath.dirList;
    } else {
      return this.baseFs.readdirSync(pnpPath.resolvedPath);
    }
  }

  async readlinkPromise(p: string) {
    return this.resolveLink(p, 'readlink',
      (_stats, targetPath) => targetPath,
      async () => await this.baseFs.readlinkPromise(p)
    );
  }

  readlinkSync(p: string) {
    return this.resolveLink(p, 'readlink',
      (_stats, targetPath) => targetPath,
      () => this.baseFs.readlinkSync(p)
    );
  }
}
