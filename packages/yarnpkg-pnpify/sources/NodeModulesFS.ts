import {BigIntStats, DirentNoPath, ReaddirOptions, Stats}                                                                          from '@yarnpkg/fslib';
import {Dirent, Filename, MkdirOptions, ExtractHintOptions, WatchFileCallback, WatchFileOptions, StatWatcher, OpendirOptions, Dir} from '@yarnpkg/fslib';
import {RmdirOptions, RmOptions}                                                                                                   from '@yarnpkg/fslib';
import {FSPath, NativePath, PortablePath, npath, ppath, opendir}                                                                   from '@yarnpkg/fslib';
import {WatchOptions, WatchCallback, Watcher}                                                                                      from '@yarnpkg/fslib';
import {NodeFS, FakeFS, WriteFileOptions, ProxiedFS}                                                                               from '@yarnpkg/fslib';
import {CreateReadStreamOptions, CreateWriteStreamOptions}                                                                         from '@yarnpkg/fslib';
import {NodeModulesTreeOptions, NodeModulesTree}                                                                                   from '@yarnpkg/nm';
import {buildNodeModulesTree}                                                                                                      from '@yarnpkg/nm';
import {PnpApi}                                                                                                                    from '@yarnpkg/pnp';
import fs                                                                                                                          from 'fs';

import {WatchManager}                                                                                                              from './WatchManager';
import {dynamicRequireNoCache}                                                                                                     from './dynamicRequire';
import {resolveNodeModulesPath, ResolvedPath}                                                                                      from './resolveNodeModulesPath';

export type NodeModulesFSOptions = {
  realFs?: typeof fs;
  pnpifyFs?: boolean;
};

export class NodeModulesFS extends ProxiedFS<NativePath, PortablePath> {
  protected readonly baseFs: FakeFS<PortablePath>;

  constructor(pnp: PnpApi, {realFs = fs, pnpifyFs = true}: NodeModulesFSOptions = {}) {
    super(npath);

    this.baseFs = new PortableNodeModulesFS(pnp, {baseFs: new NodeFS(realFs), pnpifyFs});
  }

  protected mapFromBase(path: PortablePath) {
    return npath.fromPortablePath(path);
  }

  protected mapToBase(path: NativePath) {
    return npath.toPortablePath(path);
  }
}

export interface PortableNodeModulesFSOptions extends NodeModulesTreeOptions {
  baseFs?: FakeFS<PortablePath>;
  pnpifyFs?: boolean;
}

const WRITE_FLAGS_REGEX = /[+wa]/;

export class PortableNodeModulesFS extends FakeFS<PortablePath> {
  private readonly baseFs: FakeFS<PortablePath>;
  private readonly options: PortableNodeModulesFSOptions;
  private readonly watchManager: WatchManager;
  private readonly pnpFilePath: PortablePath;
  private nodeModulesTree: NodeModulesTree;

  constructor(pnp: PnpApi, {baseFs = new NodeFS(), pnpifyFs = true}: PortableNodeModulesFSOptions = {}) {
    super(ppath);

    if (!pnp.getDependencyTreeRoots)
      throw new Error(`NodeModulesFS supports PnP API versions 3+, please upgrade your PnP API provider`);

    this.options = {baseFs, pnpifyFs};
    this.baseFs = baseFs;
    const {tree, errors} = buildNodeModulesTree(pnp, this.options);
    if (!tree)
      throw new Error(`Assertion failed. Have got non-persistable node_modules graph, errors:\n${JSON.stringify(errors)}`);
    this.nodeModulesTree = tree;
    this.watchManager = new WatchManager();

    const pnpRootPath = npath.toPortablePath(pnp.getPackageInformation(pnp.topLevel)!.packageLocation);
    this.pnpFilePath = ppath.join(pnpRootPath, Filename.pnpCjs);

    this.watchPnpFile(pnpRootPath);
  }

  private watchPnpFile(pnpRootPath: PortablePath) {
    this.baseFs.watch(pnpRootPath, {persistent: false},  (_, filename) => {
      if (filename === Filename.pnpCjs) {
        const pnp = dynamicRequireNoCache(this.pnpFilePath);
        const nodeModulesTree = buildNodeModulesTree(pnp, this.options);
        if (!nodeModulesTree)
          throw new Error(`Assertion failed. Have got non-persistable node_modules graph`);
        this.watchManager.notifyWatchers((nodePath: PortablePath) => resolveNodeModulesPath(nodePath, this.nodeModulesTree));
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

  private persistVirtualParentFolder(p: FSPath<PortablePath>) {
    if (typeof p !== `number`) {
      const parentPath = this.resolvePath(ppath.dirname(p));
      if (parentPath.dirList) {
        this.persistPath(parentPath.resolvedPath);
      }
    }
  }

  getExtractHint(hints: ExtractHintOptions) {
    return this.baseFs.getExtractHint(hints);
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
      return {...resolveNodeModulesPath(fullOriginalPath, this.nodeModulesTree), fullOriginalPath};
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

  private resolveDirOrFilePath(p: number): number;
  private resolveDirOrFilePath(p: PortablePath): PortablePath;
  private resolveDirOrFilePath(p: FSPath<PortablePath>): FSPath<PortablePath>;
  private resolveDirOrFilePath(p: FSPath<PortablePath>): FSPath<PortablePath> {
    if (typeof p === `number`)
      return p;

    const pnpPath = this.resolvePath(p);

    return pnpPath.forwardedDirPath || pnpPath.resolvedPath;
  }

  private resolveLink(opts: {
    p: PortablePath;
    op: string;
    onSymlink: (stats: fs.Stats | fs.BigIntStats, targetPath: PortablePath) => any;
    onRealPath: (targetPath: PortablePath) => any;
    statOptions?: {bigint: boolean};
  }) {
    const {p, onSymlink, onRealPath, statOptions} = opts;

    const pnpPath = this.resolvePath(p);
    if (pnpPath.isSymlink) {
      let stat;
      try {
        stat = this.baseFs.lstatSync(pnpPath.resolvedPath, statOptions);
      } catch (e) {}

      if (stat) {
        return onSymlink(stat, this.pathUtils.relative(this.pathUtils.dirname(pnpPath.fullOriginalPath), pnpPath.resolvedPath));
      }
    }
    return onRealPath(pnpPath.forwardedDirPath || pnpPath.resolvedPath);
  }

  private static makeSymlinkStats<T extends fs.Stats | fs.BigIntStats>(stats: T): T {
    return Object.assign(stats, {
      isFile: () => false,
      isDirectory: () => false,
      isSymbolicLink: () => true,
    });
  }

  getRealPath() {
    return this.baseFs.getRealPath();
  }

  async openPromise(p: PortablePath, flags: string, mode?: number) {
    if (WRITE_FLAGS_REGEX.test(flags))
      this.persistVirtualParentFolder(p);
    return await this.baseFs.openPromise(this.resolveFilePath(p), flags, mode);
  }

  openSync(p: PortablePath, flags: string, mode?: number) {
    if (WRITE_FLAGS_REGEX.test(flags))
      this.persistVirtualParentFolder(p);
    return this.baseFs.openSync(this.resolveFilePath(p), flags, mode);
  }

  async opendirPromise(p: PortablePath, opts?: OpendirOptions): Promise<Dir<PortablePath>> {
    const pnpPath = this.resolvePath(p);
    if (pnpPath.dirList || this.resolvePath(ppath.join(p, `node_modules`)).dirList) {
      let fsDirList: Array<Filename> = [];
      try {
        fsDirList = await this.baseFs.readdirPromise(pnpPath.resolvedPath);
      } catch (e) {
        // Ignore errors
      }
      const entries = Array.from(pnpPath.dirList || [`node_modules` as Filename]).concat(fsDirList).sort();

      return opendir(this, p, entries);
    } else {
      return await this.baseFs.opendirPromise(pnpPath.resolvedPath, opts);
    }
  }

  opendirSync(p: PortablePath, opts?: OpendirOptions): Dir<PortablePath> {
    const pnpPath = this.resolvePath(p);
    if (pnpPath.dirList || this.resolvePath(ppath.join(p, `node_modules`)).dirList) {
      let fsDirList: Array<Filename> = [];
      try {
        fsDirList = this.baseFs.readdirSync(pnpPath.resolvedPath);
      } catch (e) {
        // Ignore errors
      }
      const entries = Array.from(pnpPath.dirList || [`node_modules` as Filename]).concat(fsDirList).sort();

      return opendir(this, p, entries);
    } else {
      return this.baseFs.opendirSync(pnpPath.resolvedPath, opts);
    }
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
    return pnpPath.dirList ? pnpPath.resolvedPath : this.baseFs.realpathPromise(pnpPath.resolvedPath);
  }

  realpathSync(p: PortablePath) {
    const pnpPath = this.resolvePath(p);
    return pnpPath.dirList ? pnpPath.resolvedPath : this.baseFs.realpathSync(pnpPath.resolvedPath);
  }

  async existsPromise(p: PortablePath) {
    const pnpPath = this.resolvePath(p);
    if (pnpPath.dirList) {
      return true;
    } else {
      return await this.baseFs.existsPromise(pnpPath.resolvedPath);
    }
  }

  existsSync(p: PortablePath) {
    const pnpPath = this.resolvePath(p);
    if (pnpPath.dirList) {
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

  async statPromise(p: PortablePath): Promise<Stats>;
  async statPromise(p: PortablePath, opts: {bigint: true}): Promise<BigIntStats>;
  async statPromise(p: PortablePath, opts?: {bigint: boolean}): Promise<BigIntStats | Stats>;
  async statPromise(p: PortablePath, opts?: {bigint: boolean}) {
    return await this.baseFs.statPromise(this.resolveDirOrFilePath(p), opts);
  }

  statSync(p: PortablePath): Stats;
  statSync(p: PortablePath, opts: {bigint: true}): BigIntStats;
  statSync(p: PortablePath, opts?: {bigint: boolean}): BigIntStats | Stats;
  statSync(p: PortablePath, opts?: {bigint: boolean}) {
    return this.baseFs.statSync(this.resolveDirOrFilePath(p), opts);
  }

  async fstatPromise(fd: number): Promise<Stats>;
  async fstatPromise(fd: number, opts: {bigint: true}): Promise<BigIntStats>;
  async fstatPromise(fd: number, opts?: {bigint: boolean}): Promise<BigIntStats | Stats>;
  async fstatPromise(fd: number, opts?: {bigint: boolean}) {
    return await this.baseFs.fstatPromise(fd, opts);
  }

  fstatSync(fd: number): Stats;
  fstatSync(fd: number, opts: {bigint: true}): BigIntStats;
  fstatSync(fd: number, opts?: {bigint: boolean}): BigIntStats | Stats;
  fstatSync(fd: number, opts?: {bigint: boolean}) {
    return this.baseFs.fstatSync(fd, opts);
  }

  async lstatPromise(p: PortablePath): Promise<Stats>;
  async lstatPromise(p: PortablePath, opts: {bigint: true}): Promise<BigIntStats>;
  async lstatPromise(p: PortablePath, opts?: { bigint: boolean }): Promise<BigIntStats | Stats>;
  async lstatPromise(p: PortablePath, opts?: { bigint: boolean }) {
    return this.resolveLink({
      p,
      op: `lstat`,
      onSymlink: stats => PortableNodeModulesFS.makeSymlinkStats(stats),
      onRealPath: async resolvedPath => await this.baseFs.lstatPromise(resolvedPath, opts),
      statOptions: opts,
    });
  }

  lstatSync(p: PortablePath): Stats;
  lstatSync(p: PortablePath, opts: {bigint: true}): BigIntStats;
  lstatSync(p: PortablePath, opts?: { bigint: boolean }): BigIntStats | Stats;
  lstatSync(p: PortablePath, opts?: { bigint: boolean }): BigIntStats | Stats {
    return this.resolveLink({
      p,
      op: `lstat`,
      onSymlink: stats => PortableNodeModulesFS.makeSymlinkStats(stats),
      onRealPath: resolvedPath =>  this.baseFs.lstatSync(resolvedPath, opts),
      statOptions: opts,
    });
  }

  async fchmodPromise(fd: number, mask: number): Promise<void> {
    return this.baseFs.fchmodPromise(this.resolveDirOrFilePath(fd), mask);
  }

  fchmodSync(fd: number, mask: number): void {
    return this.baseFs.fchmodSync(this.resolveDirOrFilePath(fd), mask);
  }

  async chmodPromise(p: PortablePath, mask: number) {
    return await this.baseFs.chmodPromise(this.resolveDirOrFilePath(p), mask);
  }

  chmodSync(p: PortablePath, mask: number) {
    return this.baseFs.chmodSync(this.resolveDirOrFilePath(p), mask);
  }

  async fchownPromise(fd: number, uid: number, gid: number): Promise<void> {
    return this.baseFs.fchownPromise(this.resolveDirOrFilePath(fd), uid, gid);
  }

  fchownSync(fd: number, uid: number, gid: number): void {
    return this.baseFs.fchownSync(this.resolveDirOrFilePath(fd), uid, gid);
  }

  async chownPromise(p: PortablePath, uid: number, gid: number) {
    return await this.baseFs.chownPromise(this.resolveDirOrFilePath(p), uid, gid);
  }

  chownSync(p: PortablePath, uid: number, gid: number) {
    return this.baseFs.chownSync(this.resolveDirOrFilePath(p), uid, gid);
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

  async appendFilePromise(p: FSPath<PortablePath>, content: string | Uint8Array, opts?: WriteFileOptions) {
    return await this.baseFs.appendFilePromise(this.resolveDirOrFilePath(p), content, opts);
  }

  appendFileSync(p: FSPath<PortablePath>, content: string | Uint8Array, opts?: WriteFileOptions) {
    return this.baseFs.appendFileSync(this.resolveDirOrFilePath(p), content, opts);
  }

  async writeFilePromise(p: FSPath<PortablePath>, content: string | NodeJS.ArrayBufferView, opts?: WriteFileOptions) {
    return await this.baseFs.writeFilePromise(this.resolveDirOrFilePath(p), content, opts);
  }

  writeFileSync(p: FSPath<PortablePath>, content: string | NodeJS.ArrayBufferView, opts?: WriteFileOptions) {
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

  async lutimesPromise(p: PortablePath, atime: Date | string | number, mtime: Date | string | number) {
    return await this.baseFs.lutimesPromise(this.resolveDirOrFilePath(p), atime, mtime);
  }

  lutimesSync(p: PortablePath, atime: Date | string | number, mtime: Date | string | number) {
    return this.baseFs.lutimesSync(this.resolveDirOrFilePath(p), atime, mtime);
  }

  async mkdirPromise(p: PortablePath, opts: MkdirOptions) {
    const pnpPath = this.resolvePath(p);
    this.persistVirtualParentFolder(p);
    return this.baseFs.mkdirPromise(pnpPath.resolvedPath, opts);
  }

  mkdirSync(p: PortablePath, opts: MkdirOptions) {
    const pnpPath = this.resolvePath(p);
    this.persistVirtualParentFolder(p);
    return this.baseFs.mkdirSync(pnpPath.resolvedPath, opts);
  }

  async rmdirPromise(p: PortablePath, opts?: RmdirOptions) {
    return await this.baseFs.rmdirPromise(this.resolveDirOrFilePath(p), opts);
  }

  rmdirSync(p: PortablePath, opts?: RmdirOptions) {
    return this.baseFs.rmdirSync(this.resolveDirOrFilePath(p), opts);
  }

  async rmPromise(p: PortablePath, opts?: RmOptions) {
    return await this.baseFs.rmPromise(this.resolveDirOrFilePath(p), opts);
  }

  rmSync(p: PortablePath, opts?: RmOptions) {
    return this.baseFs.rmSync(this.resolveDirOrFilePath(p), opts);
  }

  async linkPromise(existingP: PortablePath, newP: PortablePath) {
    return await this.baseFs.linkPromise(this.resolveDirOrFilePath(existingP), this.resolveDirOrFilePath(newP));
  }

  linkSync(existingP: PortablePath, newP: PortablePath) {
    return this.baseFs.linkSync(this.resolveDirOrFilePath(existingP), this.resolveDirOrFilePath(newP));
  }

  async symlinkPromise(target: PortablePath, p: PortablePath) {
    return await this.baseFs.symlinkPromise(this.resolveDirOrFilePath(target), this.resolveDirOrFilePath(p));
  }

  symlinkSync(target: PortablePath, p: PortablePath) {
    return this.baseFs.symlinkSync(this.resolveDirOrFilePath(target), this.resolveDirOrFilePath(p));
  }

  readFilePromise(p: FSPath<PortablePath>, encoding?: null): Promise<Buffer>;
  readFilePromise(p: FSPath<PortablePath>, encoding: BufferEncoding): Promise<string>;
  readFilePromise(p: FSPath<PortablePath>, encoding?: BufferEncoding | null): Promise<Buffer | string>;
  async readFilePromise(p: FSPath<PortablePath>, encoding?: BufferEncoding | null) {
    return await this.baseFs.readFilePromise(this.resolveFilePath(p), encoding);
  }

  readFileSync(p: FSPath<PortablePath>, encoding?: null): Buffer;
  readFileSync(p: FSPath<PortablePath>, encoding: BufferEncoding): string;
  readFileSync(p: FSPath<PortablePath>, encoding?: BufferEncoding | null): Buffer | string;
  readFileSync(p: FSPath<PortablePath>, encoding?: BufferEncoding | null) {
    return this.baseFs.readFileSync(this.resolveFilePath(p), encoding);
  }

  async readdirPromise(p: PortablePath, opts?: null): Promise<Array<Filename>>;
  async readdirPromise(p: PortablePath, opts: {recursive?: false, withFileTypes: true}): Promise<Array<DirentNoPath>>;
  async readdirPromise(p: PortablePath, opts: {recursive?: false, withFileTypes?: false}): Promise<Array<Filename>>;
  async readdirPromise(p: PortablePath, opts: {recursive?: false, withFileTypes: boolean}): Promise<Array<DirentNoPath | Filename>>;
  async readdirPromise(p: PortablePath, opts: {recursive: true, withFileTypes: true}): Promise<Array<Dirent<PortablePath>>>;
  async readdirPromise(p: PortablePath, opts: {recursive: true, withFileTypes?: false}): Promise<Array<PortablePath>>;
  async readdirPromise(p: PortablePath, opts: {recursive: true, withFileTypes: boolean}): Promise<Array<Dirent<PortablePath> | PortablePath>>;
  async readdirPromise(p: PortablePath, opts: {recursive: boolean, withFileTypes: true}): Promise<Array<Dirent<PortablePath> | DirentNoPath>>;
  async readdirPromise(p: PortablePath, opts: {recursive: boolean, withFileTypes?: false}): Promise<Array<PortablePath>>;
  async readdirPromise(p: PortablePath, opts: {recursive: boolean, withFileTypes: boolean}): Promise<Array<Dirent<PortablePath> | DirentNoPath | PortablePath>>;
  async readdirPromise(p: PortablePath, opts?: ReaddirOptions | null): Promise<Array<Dirent<PortablePath> | DirentNoPath | PortablePath>> {
    const pnpPath = this.resolvePath(p);
    if (pnpPath.dirList || this.resolvePath(ppath.join(p, `node_modules`)).dirList) {
      if (opts?.recursive)
        throw new Error(`Unsupported option 'recursive' for NodeModulesFS.readdirPromise`);

      let fsDirList: Array<Filename> = [];
      try {
        fsDirList = await this.baseFs.readdirPromise(pnpPath.resolvedPath);
      } catch (e) {
        // Ignore errors
      }

      const entries = Array.from(pnpPath.dirList || [`node_modules` as Filename]).concat(fsDirList).sort();
      if (!opts?.withFileTypes)
        return entries;

      return entries.map(name => {
        return Object.assign(this.lstatSync(ppath.join(p, name)), {
          name,
          path: undefined,
        });
      });
    } else {
      return await this.baseFs.readdirPromise(pnpPath.resolvedPath, opts as any);
    }
  }

  readdirSync(p: PortablePath, opts?: null): Array<Filename>;
  readdirSync(p: PortablePath, opts: {recursive?: false, withFileTypes: true}): Array<DirentNoPath>;
  readdirSync(p: PortablePath, opts: {recursive?: false, withFileTypes?: false}): Array<Filename>;
  readdirSync(p: PortablePath, opts: {recursive?: false, withFileTypes: boolean}): Array<DirentNoPath | Filename>;
  readdirSync(p: PortablePath, opts: {recursive: true, withFileTypes: true}): Array<Dirent<PortablePath>>;
  readdirSync(p: PortablePath, opts: {recursive: true, withFileTypes?: false}): Array<PortablePath>;
  readdirSync(p: PortablePath, opts: {recursive: true, withFileTypes: boolean}): Array<Dirent<PortablePath> | PortablePath>;
  readdirSync(p: PortablePath, opts: {recursive: boolean, withFileTypes: true}): Array<Dirent<PortablePath> | DirentNoPath>;
  readdirSync(p: PortablePath, opts: {recursive: boolean, withFileTypes?: false}): Array<PortablePath>;
  readdirSync(p: PortablePath, opts: {recursive: boolean, withFileTypes: boolean}): Array<Dirent<PortablePath> | DirentNoPath | PortablePath>;
  readdirSync(p: PortablePath, opts?: ReaddirOptions | null): Array<Dirent<PortablePath> | DirentNoPath | PortablePath> {
    const pnpPath = this.resolvePath(p);
    if (pnpPath.dirList || this.resolvePath(ppath.join(p, `node_modules`)).dirList) {
      if (opts?.recursive)
        throw new Error(`Unsupported option 'recursive' for NodeModulesFS.readdirSync`);

      let fsDirList: Array<Filename> = [];
      try {
        fsDirList = this.baseFs.readdirSync(pnpPath.resolvedPath);
      } catch (e) {
        // Ignore errors
      }

      const entries = Array.from(pnpPath.dirList || [`node_modules` as Filename]).concat(fsDirList).sort();
      if (!opts?.withFileTypes)
        return entries;

      return entries.map(name => {
        return Object.assign(this.lstatSync(ppath.join(p, name)), {
          name,
          path: undefined,
        });
      });
    } else {
      return this.baseFs.readdirSync(pnpPath.resolvedPath, opts as any);
    }
  }

  async readlinkPromise(p: PortablePath) {
    return this.resolveLink({
      p,
      op: `readlink`,
      onSymlink: (_stats, targetPath) => targetPath,
      onRealPath: async targetPath => await this.baseFs.readlinkPromise(this.resolveDirOrFilePath(targetPath)),
    });
  }

  readlinkSync(p: PortablePath) {
    return this.resolveLink({
      p,
      op: `readlink`,
      onSymlink: (_stats, targetPath) => targetPath,
      onRealPath: targetPath => this.baseFs.readlinkSync(this.resolveDirOrFilePath(targetPath)),
    });
  }

  async truncatePromise(p: PortablePath, len?: number) {
    return await this.baseFs.truncatePromise(this.resolveDirOrFilePath(p), len);
  }

  truncateSync(p: PortablePath, len?: number) {
    return this.baseFs.truncateSync(this.resolveDirOrFilePath(p), len);
  }

  async ftruncatePromise(fd: number, len?: number): Promise<void> {
    return await this.baseFs.ftruncatePromise(fd, len);
  }

  ftruncateSync(fd: number, len?: number): void {
    return this.baseFs.ftruncateSync(fd, len);
  }

  watch(p: PortablePath, cb?: WatchCallback): Watcher;
  watch(p: PortablePath, opts: WatchOptions, cb?: WatchCallback): Watcher;
  watch(p: PortablePath, a?: WatchOptions | WatchCallback, b?: WatchCallback): Watcher {
    const pnpPath = this.resolvePath(p);
    const watchPath = pnpPath.resolvedPath;
    if (watchPath && pnpPath.dirList) {
      const callback: WatchCallback = typeof a === `function` ? a : typeof b === `function` ? b : () => {};
      return this.watchManager.registerWatcher(watchPath, pnpPath.dirList, callback);
    } else {
      return this.baseFs.watch(
        this.resolveDirOrFilePath(p),
        // @ts-expect-error
        a,
        b,
      );
    }
  }

  watchFile(p: PortablePath, cb: WatchFileCallback): StatWatcher;
  watchFile(p: PortablePath, opts: WatchFileOptions, cb: WatchFileCallback): StatWatcher;
  watchFile(p: PortablePath, a: WatchFileOptions | WatchFileCallback, b?: WatchFileCallback): StatWatcher {
    return this.baseFs.watchFile(
      this.resolveDirOrFilePath(p),
      // @ts-expect-error
      a,
      b,
    );
  }

  unwatchFile(p: PortablePath, cb?: WatchFileCallback) {
    return this.baseFs.unwatchFile(this.resolveDirOrFilePath(p), cb);
  }
}
