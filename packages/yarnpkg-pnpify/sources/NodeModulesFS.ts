import {CreateReadStreamOptions, CreateWriteStreamOptions} from '@yarnpkg/fslib';
import {NodeFS, FakeFS, WriteFileOptions, ProxiedFS}       from '@yarnpkg/fslib';
import {WatchOptions, WatchCallback, Watcher, toFilename}  from '@yarnpkg/fslib';
import {FSPath, NativePath, PortablePath, npath, ppath}    from '@yarnpkg/fslib';
import {Filename}                                          from '@yarnpkg/fslib';

import {PnpApi}                                            from '@yarnpkg/pnp';
import fs                                                  from 'fs';

import {PathResolver, ResolvedPath, HoistedPathResolver}   from './HoistedPathResolver';
import {WatchManager}                                      from './WatchManager';

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
    return npath.fromPortablePath(path);
  }

  protected mapToBase(path: NativePath) {
    return npath.toPortablePath(path);
  }
}

type PortableNodeModulesFSOptions = {
  baseFs?: FakeFS<PortablePath>
};

class PortableNodeModulesFs extends FakeFS<PortablePath> {
  private readonly baseFs: FakeFS<PortablePath>;
  private readonly watchManager: WatchManager;
  private pathResolver: PathResolver;

  constructor(pnp: PnpApi, {baseFs = new NodeFS()}: PortableNodeModulesFSOptions = {}) {
    super(ppath);

    this.baseFs = baseFs;
    this.pathResolver = this.createPathResolver(pnp);
    this.watchManager = new WatchManager();

    const pnpRootPath = npath.toPortablePath(pnp.getPackageInformation(pnp.topLevel)!.packageLocation);
    this.watchPnpFile(pnpRootPath);
  }

  private createPathResolver(pnp: PnpApi) {
    return new HoistedPathResolver(pnp);
  }

  private watchPnpFile(pnpRootPath: PortablePath) {
    const pnpFilePath = ppath.join(pnpRootPath, toFilename('.pnp.js'));
    this.baseFs.watch(pnpRootPath, {persistent: false},  (_, filename) => {
      if (filename === '.pnp.js') {
        delete require.cache[pnpFilePath];
        const pnp = require(pnpFilePath);
        this.pathResolver = this.createPathResolver(pnp);

        this.watchManager.notifyWatchers(this.pathResolver);
      }
    });
  }

  private persistPath(dir: PortablePath) {
    const pathStack = [];
    let curPath = dir;
    while (!this.baseFs.existsSync(curPath)) {
      pathStack.push(curPath);
      curPath = ppath.dirname(curPath);
    }
    for (const fullPath of pathStack.reverse()) {
      this.baseFs.mkdirSync(fullPath);
    }
  }

  resolve(path: PortablePath) {
    return this.baseFs.resolve(this.resolvePath(path).resolvedPath!);
  }

  getBaseFs() {
    return this.baseFs;
  }

  private resolvePath(p: PortablePath): ResolvedPath & { fullOriginalPath: PortablePath } {
    if (typeof p === `number`) {
      return {resolvedPath: p, realPath: p, fullOriginalPath: p};
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
    return pnpPath.resolvedPath;
  }

  private resolveDirOrFilePath(p: PortablePath): PortablePath;
  private resolveDirOrFilePath(p: FSPath<PortablePath>): FSPath<PortablePath>;
  private resolveDirOrFilePath(p: FSPath<PortablePath>): FSPath<PortablePath> {
    if (typeof p === `number`)
      return p;

    const pnpPath = this.resolvePath(p);
    return pnpPath.statPath || pnpPath.resolvedPath;
  }

  private resolveLink(p: PortablePath, op: string, onSymlink: (stats: fs.Stats, targetPath: PortablePath) => any, onRealPath: (targetPath: PortablePath) => any) {
    const pnpPath = this.resolvePath(p);
    if (pnpPath.isSymlink) {
      let stat;
      try {
        stat = this.baseFs.lstatSync(pnpPath.resolvedPath);
      } catch (e) {}

      if (stat) {
        return onSymlink(stat, this.pathUtils.relative(this.pathUtils.dirname(pnpPath.fullOriginalPath), pnpPath.resolvedPath));
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
    return this.baseFs.createWriteStream(p !== null ? this.resolveDirOrFilePath(p) : p, opts);
  }

  async realpathPromise(p: PortablePath) {
    const pnpPath = this.resolvePath(p);
    return pnpPath.realPath !== pnpPath.fullOriginalPath ? pnpPath.realPath : this.baseFs.realpathPromise(p);
  }

  realpathSync(p: PortablePath) {
    const pnpPath = this.resolvePath(p);
    return pnpPath.realPath !== pnpPath.fullOriginalPath ? pnpPath.realPath : this.baseFs.realpathSync(p);
  }

  async existsPromise(p: PortablePath) {
    const pnpPath = this.resolvePath(p);
    if (pnpPath.statPath) {
      return true;
    } else {
      return await this.baseFs.existsPromise(pnpPath.resolvedPath);
    }
  }

  existsSync(p: PortablePath) {
    const pnpPath = this.resolvePath(p);
    if (pnpPath.statPath) {
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
    return await this.baseFs.chmodPromise(this.resolveDirOrFilePath(p), mask);
  }

  chmodSync(p: PortablePath, mask: number) {
    return this.baseFs.chmodSync(this.resolveDirOrFilePath(p), mask);
  }

  async renamePromise(oldP: PortablePath, newP: PortablePath) {
    return await this.baseFs.renamePromise(this.resolveDirOrFilePath(oldP), this.resolveDirOrFilePath(newP));
  }

  renameSync(oldP: PortablePath, newP: PortablePath) {
    return this.baseFs.renameSync(this.resolveDirOrFilePath(oldP), this.resolveDirOrFilePath(newP));
  }

  async copyFilePromise(sourceP: PortablePath, destP: PortablePath, flags?: number) {
    return await this.baseFs.copyFilePromise(this.resolveFilePath(sourceP), this.resolveDirOrFilePath(destP), flags);
  }

  copyFileSync(sourceP: PortablePath, destP: PortablePath, flags?: number) {
    return this.baseFs.copyFileSync(this.resolveFilePath(sourceP), this.resolveDirOrFilePath(destP), flags);
  }

  async appendFilePromise(p: FSPath<PortablePath>, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
    return await this.baseFs.appendFilePromise(this.resolveDirOrFilePath(p), content, opts);
  }

  appendFileSync(p: FSPath<PortablePath>, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
    return this.baseFs.appendFileSync(this.resolveDirOrFilePath(p), content, opts);
  }

  async writeFilePromise(p: FSPath<PortablePath>, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
    return await this.baseFs.writeFilePromise(this.resolveDirOrFilePath(p), content, opts);
  }

  writeFileSync(p: FSPath<PortablePath>, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
    return this.baseFs.writeFileSync(this.resolveDirOrFilePath(p), content, opts);
  }

  async unlinkPromise(p: PortablePath) {
    return await this.baseFs.unlinkPromise(this.resolveDirOrFilePath(p));
  }

  unlinkSync(p: PortablePath) {
    return this.baseFs.unlinkSync(this.resolveDirOrFilePath(p));
  }

  async utimesPromise(p: PortablePath, atime: Date | string | number, mtime: Date | string | number) {
    return await this.baseFs.utimesPromise(this.resolveDirOrFilePath(p), atime, mtime);
  }

  utimesSync(p: PortablePath, atime: Date | string | number, mtime: Date | string | number) {
    return this.baseFs.utimesSync(this.resolveDirOrFilePath(p), atime, mtime);
  }

  async mkdirPromise(p: PortablePath) {
    const pnpPath = this.resolvePath(p);
    const parentPath = this.resolvePath(ppath.dirname(p));
    if (parentPath.statPath)
      this.persistPath(parentPath.resolvedPath);

    return this.baseFs.mkdirPromise(pnpPath.resolvedPath);
  }

  mkdirSync(p: PortablePath) {
    const pnpPath = this.resolvePath(p);
    const parentPath = this.resolvePath(ppath.dirname(p));
    if (parentPath.statPath)
      this.persistPath(parentPath.resolvedPath);
    return this.baseFs.mkdirSync(pnpPath.resolvedPath);
  }

  async rmdirPromise(p: PortablePath) {
    return await this.baseFs.rmdirPromise(this.resolveDirOrFilePath(p));
  }

  rmdirSync(p: PortablePath) {
    return this.baseFs.rmdirSync(this.resolveDirOrFilePath(p));
  }

  async symlinkPromise(target: PortablePath, p: PortablePath) {
    return await this.baseFs.symlinkPromise(this.resolveDirOrFilePath(target), this.resolveDirOrFilePath(p));
  }

  symlinkSync(target: PortablePath, p: PortablePath) {
    return this.baseFs.symlinkSync(this.resolveDirOrFilePath(target), this.resolveDirOrFilePath(p));
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
    if (pnpPath.dirList) {
      let fsDirList: Filename[] = [];
      try {
        fsDirList = await this.baseFs.readdirPromise(pnpPath.resolvedPath);
      } catch (e) {
        // Ignore errors
      }
      return Array.from(pnpPath.dirList).concat(fsDirList).sort();
    } else {
      return await this.baseFs.readdirPromise(pnpPath.resolvedPath);
    }
  }

  readdirSync(p: PortablePath) {
    const pnpPath = this.resolvePath(p);
    if (pnpPath.dirList) {
      let fsDirList: Filename[] = [];
      try {
        fsDirList = this.baseFs.readdirSync(pnpPath.resolvedPath);
      } catch (e) {
        // Ignore errors
      }
      return Array.from(pnpPath.dirList).concat(fsDirList).sort();
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
