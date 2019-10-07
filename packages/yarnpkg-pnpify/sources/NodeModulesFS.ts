import {CreateReadStreamOptions, CreateWriteStreamOptions, toFilename} from '@yarnpkg/fslib';
import {NodeFS, FakeFS, WriteFileOptions, ProxiedFS}                   from '@yarnpkg/fslib';
import {WatchOptions, WatchCallback, Watcher}                          from '@yarnpkg/fslib';
import {FSPath, NativePath, PortablePath, npath, ppath}                from '@yarnpkg/fslib';

import {PnpApi}                                                        from '@yarnpkg/pnp';
import fs                                                              from 'fs';

import {NodePathResolver, ResolvedPath}                                from './NodePathResolver';
import {WatchManager}                                                  from './WatchManager';

export type NodeModulesFSOptions = {
  realFs?: typeof fs
};

export class NodeModulesFS extends ProxiedFS<NativePath, PortablePath> {
  protected readonly baseFs: FakeFS<PortablePath>;

  constructor(pnp: PnpApi, {realFs = fs}: NodeModulesFSOptions = {}) {
    super(npath);

    this.baseFs = new PortableNodeModulesFs(pnp, {baseFs: new NodeFS(realFs)});
  }

  protected mapFromBase(path: PortablePath) {
    return NodeFS.fromPortablePath(path);
  }

  protected mapToBase(path: NativePath) {
    return NodeFS.toPortablePath(path);
  }
}

type PortableNodeModulesFSOptions = {
  baseFs?: FakeFS<PortablePath>
};

class PortableNodeModulesFs extends FakeFS<PortablePath> {
  private readonly baseFs: FakeFS<PortablePath>;
  private readonly watchManager: WatchManager;
  private pathResolver: NodePathResolver;

  constructor(pnp: PnpApi, {baseFs = new NodeFS()}: PortableNodeModulesFSOptions = {}) {
    super(ppath);

    this.baseFs = baseFs;
    this.pathResolver = new NodePathResolver(pnp);
    this.watchManager = new WatchManager();

    const pnpRootPath = NodeFS.toPortablePath(pnp.getPackageInformation(pnp.topLevel)!.packageLocation);
    this.watchPnpFile(pnpRootPath);
  }

  private watchPnpFile(pnpRootPath: PortablePath) {
    const pnpFilePath = ppath.join(pnpRootPath, toFilename('.pnp.js'));
    this.baseFs.watch(pnpRootPath, {persistent: false},  (_, filename) => {
      if (filename === '.pnp.js') {
        delete require.cache[pnpFilePath];
        const pnp = require(pnpFilePath);
        this.pathResolver = new NodePathResolver(pnp);

        this.watchManager.notifyWatchers(this.pathResolver);
      }
    });
  }

  resolve(path: PortablePath) {
    return this.baseFs.resolve(this.resolvePath(path).resolvedPath!);
  }

  getBaseFs() {
    return this.baseFs;
  }

  private resolvePath(p: PortablePath): ResolvedPath & { fullOriginalPath: PortablePath } {
    if (typeof p === `number`) {
      return {resolvedPath: p, fullOriginalPath: p};
    } else {
      const fullOriginalPath = this.pathUtils.resolve(p);
      return {...this.pathResolver.resolvePath(fullOriginalPath), fullOriginalPath};
    }
  }

  private resolveFilePath(p: PortablePath): PortablePath;
  private resolveFilePath(p: FSPath<PortablePath>): FSPath<PortablePath>;
  private resolveFilePath(p: FSPath<PortablePath>): FSPath<PortablePath> {
    if (typeof p === `number`)
      return p;

    const pnpPath = this.resolvePath(p);
    if (!pnpPath.resolvedPath) {
      throw PortableNodeModulesFs.createFsError('ENOENT', `no such file or directory, stat '${p}'`);
    } else {
      return pnpPath.resolvedPath;
    }
  }

  private resolveLink(p: PortablePath, op: string, onSymlink: (stats: fs.Stats, targetPath: PortablePath) => any, onRealPath: (targetPath: PortablePath) => any) {
    const pnpPath = this.resolvePath(p);
    if (!pnpPath.resolvedPath) {
      throw PortableNodeModulesFs.createFsError('ENOENT', `no such file or directory, ${op} '${p}'`);
    } else {
      if (pnpPath.resolvedPath !== pnpPath.fullOriginalPath) {
        let stat;
        try {
          stat = this.baseFs.lstatSync(pnpPath.statPath || pnpPath.resolvedPath);
        } catch (e) {}

        if (stat) {
          if (!pnpPath.isSymlink && stat.isDirectory())
            throw PortableNodeModulesFs.createFsError('EINVAL', `invalid argument, ${op} '${p}'`);

          return onSymlink(stat, this.pathUtils.relative(this.pathUtils.dirname(pnpPath.fullOriginalPath), pnpPath.statPath || pnpPath.resolvedPath));
        }
      }
    }
    return onRealPath(pnpPath.statPath || pnpPath.resolvedPath);
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

  private throwIfPathReadonly(op: string, p: PortablePath): PortablePath;
  private throwIfPathReadonly(op: string, p: FSPath<PortablePath>): FSPath<PortablePath>;
  private throwIfPathReadonly(op: string, p: FSPath<PortablePath>): FSPath<PortablePath> {
    if (typeof p === `number`)
      return p;

    const pnpPath = this.resolvePath(p);
    if (pnpPath.resolvedPath !== pnpPath.fullOriginalPath) {
      throw PortableNodeModulesFs.createFsError('EPERM', `operation not permitted, ${op} '${p}'`);
    } else {
      return p;
    }
  }

  private resolveDirOrFilePath(p: PortablePath): PortablePath {
    const pnpPath = this.resolvePath(p);
    if (!pnpPath.resolvedPath) {
      throw PortableNodeModulesFs.createFsError('ENOENT', `no such file or directory, stat '${p}'`);
    } else {
      return pnpPath.statPath || pnpPath.resolvedPath;
    }
  }

  getRealPath() {
    return this.baseFs.getRealPath();
  }

  async openPromise(p: PortablePath, flags: string, mode?: number) {
    return await this.baseFs.openPromise(this.resolveFilePath(p), flags, mode);
  }

  openSync(p: PortablePath, flags: string, mode?: number) {
    return this.baseFs.openSync(this.resolveFilePath(p), flags, mode);
  }

  async readPromise(fd: number, buffer: Buffer, offset?: number, length?: number, position?: number) {
    return await this.baseFs.readPromise(fd, buffer, offset, length, position);
  }

  readSync(fd: number, buffer: Buffer, offset?: number, length?: number, position?: number) {
    return this.baseFs.readSync(fd, buffer, offset, length, position);
  }

  writePromise(fd: number, buffer: Buffer, offset?: number, length?: number, position?: number): Promise<number>;
  writePromise(fd: number, buffer: string, position?: number): Promise<number>;
  async writePromise(fd: number, buffer: Buffer | string, offset?: number, length?: number, position?: number): Promise<number> {
    if (typeof buffer === `string`) {
      return await this.baseFs.writePromise(fd, buffer, offset);
    } else {
      return await this.baseFs.writePromise(fd, buffer, offset, length, position);
    }
  }

  writeSync(fd: number, buffer: Buffer, offset?: number, length?: number, position?: number): number;
  writeSync(fd: number, buffer: string, position?: number): number;
  writeSync(fd: number, buffer: Buffer | string, offset?: number, length?: number, position?: number) {
    if (typeof buffer === `string`) {
      return this.baseFs.writeSync(fd, buffer, offset);
    } else {
      return this.baseFs.writeSync(fd, buffer, offset, length, position);
    }
  }

  async closePromise(fd: number) {
    await this.baseFs.closePromise(fd);
  }

  closeSync(fd: number) {
    this.baseFs.closeSync(fd);
  }

  createReadStream(p: PortablePath | null, opts?: CreateReadStreamOptions) {
    return this.baseFs.createReadStream(p !== null ? this.resolveFilePath(p) : p, opts);
  }

  createWriteStream(p: PortablePath | null, opts?: CreateWriteStreamOptions) {
    return this.baseFs.createWriteStream(p !== null ? this.throwIfPathReadonly('createWriteStream', p) : p, opts);
  }

  async realpathPromise(p: PortablePath) {
    const targetPath = this.resolveFilePath(p);
    const stats = await this.baseFs.statPromise(targetPath);
    // We return the symlink paths for folder to try to keep virtual paths alive as long as we can
    return stats.isDirectory() ? targetPath : await this.baseFs.realpathPromise(targetPath);
  }

  realpathSync(p: PortablePath) {
    const targetPath = this.resolveFilePath(p);
    const stats = this.baseFs.statSync(targetPath);
    // We return the symlink paths for folder to try to keep virtual paths alive as long as we can
    return stats.isDirectory() ? targetPath : this.baseFs.realpathSync(targetPath);
  }

  async existsPromise(p: PortablePath) {
    const pnpPath = this.resolvePath(p);
    if (!pnpPath.resolvedPath) {
      return false;
    } else if (pnpPath.statPath) {
      return true;
    } else {
      return await this.baseFs.existsPromise(pnpPath.resolvedPath);
    }
  }

  existsSync(p: PortablePath) {
    const pnpPath = this.resolvePath(p);
    if (!pnpPath.resolvedPath) {
      return false;
    } else if (pnpPath.statPath) {
      return true;
    } else {
      return this.baseFs.existsSync(pnpPath.resolvedPath);
    }
  }

  async accessPromise(p: PortablePath, mode?: number) {
    return await this.baseFs.accessPromise(this.resolveDirOrFilePath(p), mode);
  }

  accessSync(p: PortablePath, mode?: number) {
    return this.baseFs.accessSync(this.resolveDirOrFilePath(p), mode);
  }

  async statPromise(p: PortablePath) {
    return await this.baseFs.statPromise(this.resolveDirOrFilePath(p));
  }

  statSync(p: PortablePath) {
    return this.baseFs.statSync(this.resolveDirOrFilePath(p));
  }

  async lstatPromise(p: PortablePath) {
    return this.resolveLink(p, 'lstat',
      (stats) => PortableNodeModulesFs.makeSymlinkStats(stats),
      async (resolvedPath) => await this.baseFs.lstatPromise(resolvedPath)
    );
  }

  lstatSync(p: PortablePath) {
    return this.resolveLink(p, 'lstat',
      (stats) => PortableNodeModulesFs.makeSymlinkStats(stats),
      (resolvedPath) => this.baseFs.lstatSync(this.resolveDirOrFilePath(resolvedPath))
    );
  }

  async chmodPromise(p: PortablePath, mask: number) {
    return await this.baseFs.chmodPromise(this.throwIfPathReadonly('chmod', p), mask);
  }

  chmodSync(p: PortablePath, mask: number) {
    return this.baseFs.chmodSync(this.throwIfPathReadonly('chmodSync', p), mask);
  }

  async renamePromise(oldP: PortablePath, newP: PortablePath) {
    return await this.baseFs.renamePromise(this.throwIfPathReadonly('rename', oldP), this.throwIfPathReadonly('rename', newP));
  }

  renameSync(oldP: PortablePath, newP: PortablePath) {
    return this.baseFs.renameSync(this.throwIfPathReadonly('renameSync', oldP), this.throwIfPathReadonly('renameSync', newP));
  }

  async copyFilePromise(sourceP: PortablePath, destP: PortablePath, flags?: number) {
    return await this.baseFs.copyFilePromise(this.resolveFilePath(sourceP), this.throwIfPathReadonly('copyFile', destP), flags);
  }

  copyFileSync(sourceP: PortablePath, destP: PortablePath, flags?: number) {
    return this.baseFs.copyFileSync(this.resolveFilePath(sourceP), this.throwIfPathReadonly('copyFileSync', destP), flags);
  }

  async appendFilePromise(p: FSPath<PortablePath>, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
    return await this.baseFs.appendFilePromise(this.throwIfPathReadonly('appendFile', p), content, opts);
  }

  appendFileSync(p: FSPath<PortablePath>, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
    return this.baseFs.appendFileSync(this.throwIfPathReadonly('appendFileSync', p), content, opts);
  }

  async writeFilePromise(p: FSPath<PortablePath>, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
    return await this.baseFs.writeFilePromise(this.throwIfPathReadonly('writeFile', p), content, opts);
  }

  writeFileSync(p: FSPath<PortablePath>, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
    return this.baseFs.writeFileSync(this.throwIfPathReadonly('writeFileSync', p), content, opts);
  }

  async unlinkPromise(p: PortablePath) {
    return await this.baseFs.unlinkPromise(this.throwIfPathReadonly('unlink', p));
  }

  unlinkSync(p: PortablePath) {
    return this.baseFs.unlinkSync(this.throwIfPathReadonly('unlinkSync', p));
  }

  async utimesPromise(p: PortablePath, atime: Date | string | number, mtime: Date | string | number) {
    return await this.baseFs.utimesPromise(this.resolveDirOrFilePath(p), atime, mtime);
  }

  utimesSync(p: PortablePath, atime: Date | string | number, mtime: Date | string | number) {
    return this.baseFs.utimesSync(this.resolveDirOrFilePath(p), atime, mtime);
  }

  async mkdirPromise(p: PortablePath) {
    return await this.baseFs.mkdirPromise(this.throwIfPathReadonly('mkdir', p));
  }

  mkdirSync(p: PortablePath) {
    return this.baseFs.mkdirSync(this.throwIfPathReadonly('mkdirSync', p));
  }

  async rmdirPromise(p: PortablePath) {
    return await this.baseFs.rmdirPromise(this.throwIfPathReadonly('rmdir', p));
  }

  rmdirSync(p: PortablePath) {
    return this.baseFs.rmdirSync(this.throwIfPathReadonly('rmdirSync', p));
  }

  async symlinkPromise(target: PortablePath, p: PortablePath) {
    return await this.baseFs.symlinkPromise(this.resolveDirOrFilePath(target), this.throwIfPathReadonly('symlink', p));
  }

  symlinkSync(target: PortablePath, p: PortablePath) {
    return this.baseFs.symlinkSync(this.resolveDirOrFilePath(target), this.throwIfPathReadonly('symlinkSync', p));
  }

  readFilePromise(p: FSPath<PortablePath>, encoding: 'utf8'): Promise<string>;
  readFilePromise(p: FSPath<PortablePath>, encoding?: string): Promise<Buffer>;
  async readFilePromise(p: FSPath<PortablePath>, encoding?: string) {
    // This weird switch is required to tell TypeScript that the signatures are proper (otherwise it thinks that only the generic one is covered)
    switch (encoding) {
      case `utf8`:
        return await this.baseFs.readFilePromise(this.resolveFilePath(p), encoding);
      default:
        return await this.baseFs.readFilePromise(this.resolveFilePath(p), encoding);
    }
  }

  readFileSync(p: FSPath<PortablePath>, encoding: 'utf8'): string;
  readFileSync(p: FSPath<PortablePath>, encoding?: string): Buffer;
  readFileSync(p: FSPath<PortablePath>, encoding?: string) {
    // This weird switch is required to tell TypeScript that the signatures are proper (otherwise it thinks that only the generic one is covered)
    switch (encoding) {
      case `utf8`:
        return this.baseFs.readFileSync(this.resolveFilePath(p), encoding);
      default:
        return this.baseFs.readFileSync(this.resolveFilePath(p), encoding);
    }
  }

  async readdirPromise(p: PortablePath) {
    const pnpPath = this.resolvePath(p);
    if (!pnpPath.resolvedPath) {
      throw PortableNodeModulesFs.createFsError('ENOENT', `no such file or directory, scandir '${p}'`);
    } else if (pnpPath.dirList) {
      return Array.from(pnpPath.dirList);
    } else {
      return await this.baseFs.readdirPromise(pnpPath.resolvedPath);
    }
  }

  readdirSync(p: PortablePath) {
    const pnpPath = this.resolvePath(p);
    if (!pnpPath.resolvedPath) {
      throw PortableNodeModulesFs.createFsError('ENOENT', `no such file or directory, scandir '${p}'`);
    } else if (pnpPath.dirList) {
      return Array.from(pnpPath.dirList);
    } else {
      return this.baseFs.readdirSync(pnpPath.resolvedPath);
    }
  }

  async readlinkPromise(p: PortablePath) {
    return this.resolveLink(p, 'readlink',
      (_stats, targetPath) => targetPath,
      async (targetPath) => await this.baseFs.readlinkPromise(this.resolveDirOrFilePath(targetPath))
    );
  }

  readlinkSync(p: PortablePath) {
    return this.resolveLink(p, 'readlink',
      (_stats, targetPath) => targetPath,
      (targetPath) => this.baseFs.readlinkSync(this.resolveDirOrFilePath(targetPath))
    );
  }

  watch(p: PortablePath, cb?: WatchCallback): Watcher;
  watch(p: PortablePath, opts: WatchOptions, cb?: WatchCallback): Watcher;
  watch(p: PortablePath, a?: WatchOptions | WatchCallback, b?: WatchCallback): Watcher {
    const pnpPath = this.resolvePath(p);
    const watchPath = pnpPath.resolvedPath;
    if (watchPath && pnpPath.dirList) {
      const callback: WatchCallback = typeof a === 'function' ? a : typeof b === 'function' ? b : () => {};
      return this.watchManager.registerWatcher(watchPath, pnpPath.dirList, callback);
    } else {
      return this.baseFs.watch(
        p,
        // @ts-ignore
        a,
        b,
      );
    }
  }
}
