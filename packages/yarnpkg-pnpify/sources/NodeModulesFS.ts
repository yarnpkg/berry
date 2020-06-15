import {Dirent, Filename, MkdirOptions,ExtractHintOptions} from '@yarnpkg/fslib';
import {FSPath, NativePath, PortablePath, npath, ppath}    from '@yarnpkg/fslib';
import {WatchOptions, WatchCallback, Watcher, toFilename}  from '@yarnpkg/fslib';
import {NodeFS, FakeFS, WriteFileOptions, ProxiedFS}       from '@yarnpkg/fslib';
import {CreateReadStreamOptions, CreateWriteStreamOptions} from '@yarnpkg/fslib';
import {PnpApi}                                            from '@yarnpkg/pnp';
import fs                                                  from 'fs';

import {WatchManager}                                      from './WatchManager';
import {NodeModulesTreeOptions, NodeModulesTree}           from './buildNodeModulesTree';
import {buildNodeModulesTree}                              from './buildNodeModulesTree';
import {resolveNodeModulesPath, ResolvedPath}              from './resolveNodeModulesPath';

export type NodeModulesFSOptions = {
  realFs?: typeof fs,
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

interface PortableNodeModulesFSOptions extends NodeModulesTreeOptions {
  baseFs?: FakeFS<PortablePath>
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
    this.nodeModulesTree = buildNodeModulesTree(pnp, this.options);
    this.watchManager = new WatchManager();

    const pnpRootPath = npath.toPortablePath(pnp.getPackageInformation(pnp.topLevel)!.packageLocation);
    this.pnpFilePath = ppath.join(pnpRootPath, toFilename(`.pnp.js`));

    this.watchPnpFile(pnpRootPath);
  }

  private watchPnpFile(pnpRootPath: PortablePath) {
    this.baseFs.watch(pnpRootPath, {persistent: false},  (_, filename) => {
      if (filename === `.pnp.js`) {
        delete require.cache[this.pnpFilePath];
        const pnp = require(this.pnpFilePath);
        this.nodeModulesTree = buildNodeModulesTree(pnp, this.options);
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

  private resolveDirOrFilePath(p: PortablePath): PortablePath;
  private resolveDirOrFilePath(p: FSPath<PortablePath>): FSPath<PortablePath>;
  private resolveDirOrFilePath(p: FSPath<PortablePath>): FSPath<PortablePath> {
    if (typeof p === `number`)
      return p;

    const pnpPath = this.resolvePath(p);

    return pnpPath.forwardedDirPath || pnpPath.resolvedPath;
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
    return onRealPath(pnpPath.forwardedDirPath || pnpPath.resolvedPath);
  }

  private static makeSymlinkStats(stats: fs.Stats): fs.Stats {
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

  async statPromise(p: PortablePath) {
    return await this.baseFs.statPromise(this.resolveDirOrFilePath(p));
  }

  statSync(p: PortablePath) {
    return this.baseFs.statSync(this.resolveDirOrFilePath(p));
  }

  async lstatPromise(p: PortablePath) {
    return this.resolveLink(p, `lstat`,
      stats => PortableNodeModulesFS.makeSymlinkStats(stats),
      async resolvedPath => await this.baseFs.lstatPromise(resolvedPath)
    );
  }

  lstatSync(p: PortablePath) {
    return this.resolveLink(p, `lstat`,
      stats => PortableNodeModulesFS.makeSymlinkStats(stats),
      resolvedPath => this.baseFs.lstatSync(this.resolveDirOrFilePath(resolvedPath))
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

  async readdirPromise(p: PortablePath): Promise<Array<Filename>>;
  async readdirPromise(p: PortablePath, opts: {withFileTypes: false}): Promise<Array<Filename>>;
  async readdirPromise(p: PortablePath, opts: {withFileTypes: true}): Promise<Array<Dirent>>;
  async readdirPromise(p: PortablePath, opts: {withFileTypes: boolean}): Promise<Array<Filename> | Array<Dirent>>;
  async readdirPromise(p: PortablePath, {withFileTypes}: {withFileTypes?: boolean} = {}): Promise<Array<string> | Array<Dirent>> {
    const pnpPath = this.resolvePath(p);
    if (pnpPath.dirList || this.resolvePath(ppath.join(p, toFilename(`node_modules`))).dirList) {
      let fsDirList: Array<Filename> = [];
      try {
        fsDirList = await this.baseFs.readdirPromise(pnpPath.resolvedPath);
      } catch (e) {
        // Ignore errors
      }
      const entries = Array.from(pnpPath.dirList || [toFilename(`node_modules`)]).concat(fsDirList).sort();
      if (!withFileTypes)
        return entries;

      return entries.map(name => {
        return Object.assign(this.lstatSync(ppath.join(p, name)), {
          name,
        });
      });
    } else {
      return await this.baseFs.readdirPromise(pnpPath.resolvedPath, {withFileTypes: withFileTypes as any});
    }
  }

  readdirSync(p: PortablePath): Array<Filename>;
  readdirSync(p: PortablePath, opts: {withFileTypes: false}): Array<Filename>;
  readdirSync(p: PortablePath, opts: {withFileTypes: true}): Array<Dirent>;
  readdirSync(p: PortablePath, opts: {withFileTypes: boolean}): Array<Filename> | Array<Dirent>;
  readdirSync(p: PortablePath, {withFileTypes}: {withFileTypes?: boolean} = {}): Array<string> | Array<Dirent> {
    const pnpPath = this.resolvePath(p);
    if (pnpPath.dirList || this.resolvePath(ppath.join(p, toFilename(`node_modules`))).dirList) {
      let fsDirList: Array<Filename> = [];
      try {
        fsDirList = this.baseFs.readdirSync(pnpPath.resolvedPath);
      } catch (e) {
        // Ignore errors
      }
      const entries = Array.from(pnpPath.dirList || [toFilename(`node_modules`)]).concat(fsDirList).sort();
      if (!withFileTypes)
        return entries;

      return entries.map(name => {
        return Object.assign(this.lstatSync(ppath.join(p, name)), {
          name,
        });
      });
    } else {
      return this.baseFs.readdirSync(pnpPath.resolvedPath, {withFileTypes: withFileTypes as any});
    }
  }

  async readlinkPromise(p: PortablePath) {
    return this.resolveLink(p, `readlink`,
      (_stats, targetPath) => targetPath,
      async targetPath => await this.baseFs.readlinkPromise(this.resolveDirOrFilePath(targetPath))
    );
  }

  readlinkSync(p: PortablePath) {
    return this.resolveLink(p, `readlink`,
      (_stats, targetPath) => targetPath,
      targetPath => this.baseFs.readlinkSync(this.resolveDirOrFilePath(targetPath))
    );
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
        p,
        // @ts-ignore
        a,
        b,
      );
    }
  }
}
