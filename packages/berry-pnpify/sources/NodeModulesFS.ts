import {CreateReadStreamOptions, CreateWriteStreamOptions} from '@berry/fslib';
import {NodeFS, PosixFS, FakeFS, WriteFileOptions}         from '@berry/fslib';
import {NativePath, Path, npath}                           from '@berry/fslib';

import fs                                                  from 'fs';

import {NodePathResolver, ResolvedPath}                    from './NodePathResolver';
import {PnPApiLoader}                                      from './PnPApiLoader';
import {PnPApiLocator}                                     from './PnPApiLocator';

export type NodeModulesFSOptions = {
  baseFs?: FakeFS<NativePath>
};

export class NodeModulesFS extends FakeFS<NativePath> {
  private readonly baseFs: FakeFS<NativePath>;
  private readonly pathResolver: NodePathResolver;

  constructor({baseFs = new PosixFS(new NodeFS())}: NodeModulesFSOptions = {}) {
    super(npath);

    this.baseFs = baseFs;
    this.pathResolver = new NodePathResolver({
      apiLoader: new PnPApiLoader({watch: (fs as any).watch.bind(fs)}),
      apiLocator: new PnPApiLocator({existsSync: baseFs.existsSync.bind(baseFs)}),
    });
  }

  resolve(path: NativePath) {
    return this.baseFs.resolve(this.resolvePath(path).resolvedPath!);
  }

  getBaseFs() {
    return this.baseFs;
  }

  private resolvePath(p: NativePath): ResolvedPath & { fullOriginalPath: NativePath } {
    const fullOriginalPath = npath.resolve(p);
    return {...this.pathResolver.resolvePath(fullOriginalPath), fullOriginalPath};
  }

  private resolveFilePath(p: NativePath): NativePath {
    const pnpPath = this.resolvePath(p);
    if (!pnpPath.resolvedPath) {
      throw NodeModulesFS.createFsError('ENOENT', `no such file or directory, stat '${p}'`);
    } else {
      return pnpPath.resolvedPath;
    }
  }

  private resolveLink(p: NativePath, op: string, onSymlink: (stats: fs.Stats, targetPath: NativePath) => any, onRealPath: () => any) {
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
            return onSymlink(stats, npath.relative(npath.dirname(pnpPath.fullOriginalPath), pnpPath.statPath || pnpPath.resolvedPath));
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

  private throwIfPathReadonly(op: NativePath, p: NativePath): NativePath {
    const pnpPath = this.resolvePath(p);
    if (pnpPath.resolvedPath !== pnpPath.fullOriginalPath) {
      throw NodeModulesFS.createFsError('EPERM', `operation not permitted, ${op} '${p}'`);
    } else {
      return p;
    }
  }

  private resolveDirOrFilePath(p: NativePath): NativePath {
    const pnpPath = this.resolvePath(p);
    if (!pnpPath.resolvedPath) {
      throw NodeModulesFS.createFsError('ENOENT', `no such file or directory, stat '${p}'`);
    } else {
      return pnpPath.statPath || pnpPath.resolvedPath;
    }
  }

  getRealPath() {
    return this.baseFs.getRealPath();
  }

  async openPromise(p: NativePath, flags: string, mode?: number) {
    return await this.baseFs.openPromise(this.resolveFilePath(p), flags, mode);
  }

  openSync(p: NativePath, flags: string, mode?: number) {
    return this.baseFs.openSync(this.resolveFilePath(p), flags, mode);
  }

  async closePromise(fd: number) {
    await this.baseFs.closePromise(fd);
  }

  closeSync(fd: number) {
    this.baseFs.closeSync(fd);
  }

  createReadStream(p: NativePath, opts?: CreateReadStreamOptions) {
    return this.baseFs.createReadStream(this.resolveFilePath(p), opts);
  }

  createWriteStream(p: NativePath, opts?: CreateWriteStreamOptions) {
    return this.baseFs.createWriteStream(this.throwIfPathReadonly('createWriteStream', p), opts);
  }

  async realpathPromise(p: NativePath) {
    return await this.baseFs.realpathPromise(this.resolveFilePath(p));
  }

  realpathSync(p: NativePath) {
    return this.baseFs.realpathSync(this.resolveFilePath(p));
  }

  async existsPromise(p: NativePath) {
    const pnpPath = this.resolvePath(p);
    if (!pnpPath.resolvedPath) {
      return false;
    } else if (pnpPath.statPath) {
      return true;
    } else {
      return await this.baseFs.existsPromise(pnpPath.resolvedPath);
    }
  }

  existsSync(p: NativePath) {
    const pnpPath = this.resolvePath(p);
    if (!pnpPath.resolvedPath) {
      return false;
    } else if (pnpPath.statPath) {
      return true;
    } else {
      return this.baseFs.existsSync(pnpPath.resolvedPath);
    }
  }

  async accessPromise(p: NativePath, mode?: number) {
    return await this.baseFs.accessPromise(this.resolveDirOrFilePath(p), mode);
  }

  accessSync(p: NativePath, mode?: number) {
    return this.baseFs.accessSync(this.resolveDirOrFilePath(p), mode);
  }

  async statPromise(p: NativePath) {
    return await this.baseFs.statPromise(this.resolveDirOrFilePath(p));
  }

  statSync(p: NativePath) {
    return this.baseFs.statSync(this.resolveDirOrFilePath(p));
  }

  async lstatPromise(p: NativePath) {
    return this.resolveLink(p, 'lstat',
      (stats) => NodeModulesFS.makeSymlinkStats(stats),
      async () => await this.baseFs.lstatPromise(p)
    );
  }

  lstatSync(p: NativePath) {
    return this.resolveLink(p, 'lstat',
      (stats) => NodeModulesFS.makeSymlinkStats(stats),
      () => this.baseFs.lstatSync(p)
    );
  }

  async chmodPromise(p: NativePath, mask: number) {
    return await this.baseFs.chmodPromise(this.throwIfPathReadonly('chmod', p), mask);
  }

  chmodSync(p: NativePath, mask: number) {
    return this.baseFs.chmodSync(this.throwIfPathReadonly('chmodSync', p), mask);
  }

  async renamePromise(oldP: NativePath, newP: NativePath) {
    return await this.baseFs.renamePromise(this.throwIfPathReadonly('rename', oldP), this.throwIfPathReadonly('rename', newP));
  }

  renameSync(oldP: NativePath, newP: NativePath) {
    return this.baseFs.renameSync(this.throwIfPathReadonly('renameSync', oldP), this.throwIfPathReadonly('renameSync', newP));
  }

  async copyFilePromise(sourceP: NativePath, destP: NativePath, flags?: number) {
    return await this.baseFs.copyFilePromise(this.resolveFilePath(sourceP), this.throwIfPathReadonly('copyFile', destP), flags);
  }

  copyFileSync(sourceP: NativePath, destP: NativePath, flags?: number) {
    return this.baseFs.copyFileSync(this.resolveFilePath(sourceP), this.throwIfPathReadonly('copyFileSync', destP), flags);
  }

  async writeFilePromise(p: NativePath, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
    return await this.baseFs.writeFilePromise(this.throwIfPathReadonly('writeFile', p), content, opts);
  }

  writeFileSync(p: NativePath, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
    return this.baseFs.writeFileSync(this.throwIfPathReadonly('writeFileSync', p), content, opts);
  }

  async unlinkPromise(p: NativePath) {
    return await this.baseFs.unlinkPromise(this.throwIfPathReadonly('unlink', p));
  }

  unlinkSync(p: NativePath) {
    return this.baseFs.unlinkSync(this.throwIfPathReadonly('unlinkSync', p));
  }

  async utimesPromise(p: NativePath, atime: Date | string | number, mtime: Date | string | number) {
    return await this.baseFs.utimesPromise(this.resolveDirOrFilePath(p), atime, mtime);
  }

  utimesSync(p: NativePath, atime: Date | string | number, mtime: Date | string | number) {
    return this.baseFs.utimesSync(this.resolveDirOrFilePath(p), atime, mtime);
  }

  async mkdirPromise(p: NativePath) {
    return await this.baseFs.mkdirPromise(this.throwIfPathReadonly('mkdir', p));
  }

  mkdirSync(p: NativePath) {
    return this.baseFs.mkdirSync(this.throwIfPathReadonly('mkdirSync', p));
  }

  async rmdirPromise(p: NativePath) {
    return await this.baseFs.rmdirPromise(this.throwIfPathReadonly('rmdir', p));
  }

  rmdirSync(p: NativePath) {
    return this.baseFs.rmdirSync(this.throwIfPathReadonly('rmdirSync', p));
  }

  async symlinkPromise(target: NativePath, p: NativePath) {
    return await this.baseFs.symlinkPromise(this.resolveDirOrFilePath(target), this.throwIfPathReadonly('symlink', p));
  }

  symlinkSync(target: NativePath, p: string) {
    return this.baseFs.symlinkSync(this.resolveDirOrFilePath(target), this.throwIfPathReadonly('symlinkSync', p));
  }

  readFilePromise(p: NativePath, encoding: 'utf8'): Promise<string>;
  readFilePromise(p: NativePath, encoding?: string): Promise<Buffer>;
  async readFilePromise(p: NativePath, encoding?: string) {
    // This weird switch is required to tell TypeScript that the signatures are proper (otherwise it thinks that only the generic one is covered)
    switch (encoding) {
      case `utf8`:
        return await this.baseFs.readFilePromise(this.resolveFilePath(p), encoding);
      default:
        return await this.baseFs.readFilePromise(this.resolveFilePath(p), encoding);
    }
  }

  readFileSync(p: NativePath, encoding: 'utf8'): string;
  readFileSync(p: NativePath, encoding?: string): Buffer;
  readFileSync(p: NativePath, encoding?: string) {
    // This weird switch is required to tell TypeScript that the signatures are proper (otherwise it thinks that only the generic one is covered)
    switch (encoding) {
      case `utf8`:
        return this.baseFs.readFileSync(this.resolveFilePath(p), encoding);
      default:
        return this.baseFs.readFileSync(this.resolveFilePath(p), encoding);
    }
  }

  async readdirPromise(p: NativePath) {
    const pnpPath = this.resolvePath(p);
    if (!pnpPath.resolvedPath) {
      throw NodeModulesFS.createFsError('ENOENT', `no such file or directory, scandir '${p}'`);
    } else if (pnpPath.dirList) {
      return pnpPath.dirList;
    } else {
      return await this.baseFs.readdirPromise(pnpPath.resolvedPath);
    }
  }

  readdirSync(p: NativePath) {
    const pnpPath = this.resolvePath(p);
    if (!pnpPath.resolvedPath) {
      throw NodeModulesFS.createFsError('ENOENT', `no such file or directory, scandir '${p}'`);
    } else if (pnpPath.dirList) {
      return pnpPath.dirList;
    } else {
      return this.baseFs.readdirSync(pnpPath.resolvedPath);
    }
  }

  async readlinkPromise(p: NativePath) {
    return this.resolveLink(p, 'readlink',
      (_stats, targetPath) => targetPath,
      async () => await this.baseFs.readlinkPromise(p)
    );
  }

  readlinkSync(p: NativePath) {
    return this.resolveLink(p, 'readlink',
      (_stats, targetPath) => targetPath,
      () => this.baseFs.readlinkSync(p)
    );
  }

  removePromise(p: NativePath) {
    return this.baseFs.removePromise(this.throwIfPathReadonly(`remove`, p));
  }

  removeSync(p: NativePath) {
    return this.baseFs.removeSync(this.throwIfPathReadonly(`removeSync`, p));
  }

  mkdirpPromise(p: NativePath, options?: {chmod?: number, utimes?: [Date | string | number, Date | string | number]}) {
    return this.baseFs.mkdirpPromise(this.throwIfPathReadonly(`mkdirp`, p), options);
  }
  mkdirpSync(p: NativePath, options?: {chmod?: number, utimes?: [Date | string | number, Date | string | number]}) {
    return this.baseFs.mkdirpSync(this.throwIfPathReadonly(`mkdirpSync`, p), options);
  }

  copyPromise(destination: NativePath, source: NativePath, options?: {baseFs?: undefined, overwrite?: boolean}): Promise<void>;
  copyPromise<P2 extends Path>(destination: NativePath, source: P2, options: {baseFs: FakeFS<P2>, overwrite?: boolean}): Promise<void>;
  copyPromise<P2 extends Path>(destination: NativePath, source: P2, {baseFs = this as any, overwrite}: {baseFs?: FakeFS<P2>, overwrite?: boolean} = {}) {
    // any casts are necessary because typescript doesn't understand that P2 might be P
    if (baseFs === this as any) {
      return this.baseFs.copyPromise(this.throwIfPathReadonly(`copy`, destination), source, {baseFs: this.baseFs as any, overwrite});
    } else {
      return this.baseFs.copyPromise(this.throwIfPathReadonly(`copy`, destination), source, {baseFs, overwrite});
    }
  }

  copySync(destination: NativePath, source: NativePath, options?: {baseFs?: undefined, overwrite?: boolean}): void;
  copySync<P2 extends Path>(destination: NativePath, source: P2, options: {baseFs: FakeFS<P2>, overwrite?: boolean}): void;
  copySync<P2 extends Path>(destination: NativePath, source: P2, {baseFs = this as any, overwrite}: {baseFs?: FakeFS<P2>, overwrite?: boolean} = {}) {
    // any casts are necessary because typescript doesn't understand that P2 might be P
    if (baseFs === this as any) {
      return this.baseFs.copySync(this.throwIfPathReadonly(`copySync`, destination), source, {baseFs: this.baseFs as any, overwrite});
    } else {
      return this.baseFs.copySync(this.throwIfPathReadonly(`copySync`, destination), source, {baseFs, overwrite});
    }
  }
}
