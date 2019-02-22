import {posix}                                             from 'path';

import {CreateReadStreamOptions, CreateWriteStreamOptions} from './FakeFS';
import {FakeFS, WriteFileOptions}                          from './FakeFS';
import {NodeFS}                                            from './NodeFS';
import {ZipFS}                                             from './ZipFS';

export type ZipOpenFSOptions = {
  baseFs?: FakeFS,
  filter?: RegExp | null,
  useCache?: boolean,
};

export class ZipOpenFS extends FakeFS {
  static open<T>(fn: (zipOpenFs: ZipOpenFS) => Promise<T>): Promise<T> {
    const zipOpenFs = new ZipOpenFS();
    try {
      return fn(zipOpenFs);
    } finally {
      zipOpenFs.saveAndClose();
    }
  }

  static async openPromise<T>(fn: (zipOpenFs: ZipOpenFS) => Promise<T>): Promise<T> {
    const zipOpenFs = new ZipOpenFS();
    try {
      return await fn(zipOpenFs);
    } finally {
      zipOpenFs.saveAndClose();
    }
  }

  private readonly baseFs: FakeFS;

  private readonly zipInstances: Map<string, ZipFS> | null;

  private readonly filter?: RegExp | null;

  private isZip: Set<string> = new Set();
  private notZip: Set<string> = new Set();

  constructor({baseFs = new NodeFS(), filter = null, useCache = true}: ZipOpenFSOptions = {}) {
    super();

    this.baseFs = baseFs;

    this.zipInstances = useCache ? new Map() : null;

    this.filter = filter;

    this.isZip = new Set();
    this.notZip = new Set();
  }

  getRealPath() {
    return this.baseFs.getRealPath();
  }

  saveAndClose() {
    if (this.zipInstances) {
      for (const [path, zipFs] of this.zipInstances.entries()) {
        zipFs.saveAndClose();
        this.zipInstances.delete(path);
      }
    }
  }

  discardAndClose() {
    if (this.zipInstances) {
      for (const [path, zipFs] of this.zipInstances.entries()) {
        zipFs.discardAndClose();
        this.zipInstances.delete(path);
      }
    }
  }

  async openPromise(p: string, flags: string, mode?: number) {
    return await this.makeCallPromise(p, async () => {
      return await this.baseFs.openPromise(p, flags, mode);
    }, async (zipFs, {archivePath, subPath}) => {
      throw new Error(`Unsupported action (we wouldn't be able to disambiguate the close)`);
    });
  }

  openSync(p: string, flags: string, mode?: number) {
    return this.makeCallSync(p, () => {
      return this.baseFs.openSync(p, flags, mode);
    }, (zipFs, {archivePath, subPath}) => {
      throw new Error(`Unsupported action (we wouldn't be able to disambiguate the close)`);
    });
  }

  async closePromise(fd: number) {
    return await this.baseFs.closePromise(fd);
  }

  closeSync(fd: number) {
    return this.baseFs.closeSync(fd);
  }

  createReadStream(p: string, opts?: CreateReadStreamOptions) {
    return this.makeCallSync(p, () => {
      return this.baseFs.createReadStream(p, opts);
    }, (zipFs, {subPath}) => {
      return zipFs.createReadStream(subPath, opts);
    });
  }

  createWriteStream(p: string, opts?: CreateWriteStreamOptions) {
    return this.makeCallSync(p, () => {
      return this.baseFs.createWriteStream(p, opts);
    }, (zipFs, {subPath}) => {
      return zipFs.createWriteStream(subPath, opts);
    });
  }

  async realpathPromise(p: string) {
    return await this.makeCallPromise(p, async () => {
      return await this.baseFs.realpathPromise(p);
    }, async (zipFs, {archivePath, subPath}) => {
      return posix.resolve(archivePath, posix.relative(`/`, await zipFs.realpathPromise(subPath)));
    });
  }

  realpathSync(p: string) {
    return this.makeCallSync(p, () => {
      return this.baseFs.realpathSync(p);
    }, (zipFs, {archivePath, subPath}) => {
      return posix.resolve(archivePath, posix.relative(`/`, zipFs.realpathSync(subPath)));
    });
  }

  async existsPromise(p: string) {
    return await this.makeCallPromise(p, async () => {
      return await this.baseFs.existsPromise(p);
    }, async (zipFs, {archivePath, subPath}) => {
      return await zipFs.existsPromise(subPath);
    });
  }

  existsSync(p: string) {
    return this.makeCallSync(p, () => {
      return this.baseFs.existsSync(p);
    }, (zipFs, {subPath}) => {
      return zipFs.existsSync(subPath);
    });
  }

  async statPromise(p: string) {
    return await this.makeCallPromise(p, async () => {
      return await this.baseFs.statPromise(p);
    }, async (zipFs, {archivePath, subPath}) => {
      return await zipFs.statPromise(subPath);
    });
  }

  statSync(p: string) {
    return this.makeCallSync(p, () => {
      return this.baseFs.statSync(p);
    }, (zipFs, {subPath}) => {
      return zipFs.statSync(subPath);
    });
  }

  async lstatPromise(p: string) {
    return await this.makeCallPromise(p, async () => {
      return await this.baseFs.lstatPromise(p);
    }, async (zipFs, {archivePath, subPath}) => {
      return await zipFs.lstatPromise(subPath);
    });
  }

  lstatSync(p: string) {
    return this.makeCallSync(p, () => {
      return this.baseFs.lstatSync(p);
    }, (zipFs, {subPath}) => {
      return zipFs.lstatSync(subPath);
    });
  }

  async chmodPromise(p: string, mask: number) {
    return await this.makeCallPromise(p, async () => {
      return await this.baseFs.chmodPromise(p, mask);
    }, async (zipFs, {archivePath, subPath}) => {
      return await zipFs.chmodPromise(subPath, mask);
    });
  }

  chmodSync(p: string, mask: number) {
    return this.makeCallSync(p, () => {
      return this.baseFs.chmodSync(p, mask);
    }, (zipFs, {subPath}) => {
      return zipFs.chmodSync(subPath, mask);
    });
  }

  async renamePromise(oldP: string, newP: string) {
    return await this.makeCallPromise(oldP, async () => {
      return await this.makeCallPromise(newP, async () => {
        return await this.baseFs.renamePromise(oldP, newP);
      }, async () => {
        throw Object.assign(new Error(`EEXDEV: cross-device link not permitted`), {code: `EEXDEV`});
      });
    }, async (zipFsO, {archivePath: archivePathO, subPath: subPathO}) => {
      return await this.makeCallPromise(newP, async () => {
        throw Object.assign(new Error(`EEXDEV: cross-device link not permitted`), {code: `EEXDEV`});
      }, async (zipFsN, {archivePath: archivePathN, subPath: subPathN}) => {
        if (zipFsO !== zipFsN) {
          throw Object.assign(new Error(`EEXDEV: cross-device link not permitted`), {code: `EEXDEV`});
        } else {
          return await zipFsO.renamePromise(subPathO, subPathN);
        }
      });
    });
  }

  renameSync(oldP: string, newP: string) {
    return this.makeCallSync(oldP, async () => {
      return this.makeCallSync(newP, async () => {
        return this.baseFs.renameSync(oldP, newP);
      }, async () => {
        throw Object.assign(new Error(`EEXDEV: cross-device link not permitted`), {code: `EEXDEV`});
      });
    }, async (zipFsO, {archivePath: archivePathO, subPath: subPathO}) => {
      return this.makeCallSync(newP, async () => {
        throw Object.assign(new Error(`EEXDEV: cross-device link not permitted`), {code: `EEXDEV`});
      }, async (zipFsN, {archivePath: archivePathN, subPath: subPathN}) => {
        if (zipFsO !== zipFsN) {
          throw Object.assign(new Error(`EEXDEV: cross-device link not permitted`), {code: `EEXDEV`});
        } else {
          return zipFsO.renameSync(subPathO, subPathN);
        }
      });
    });
  }

  async writeFilePromise(p: string, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
    return await this.makeCallPromise(p, async () => {
      return await this.baseFs.writeFilePromise(p, content, opts);
    }, async (zipFs, {archivePath, subPath}) => {
      return await zipFs.writeFilePromise(subPath, content, opts);
    });
  }

  writeFileSync(p: string, content: string | Buffer | ArrayBuffer | DataView, opts?: WriteFileOptions) {
    return this.makeCallSync(p, () => {
      return this.baseFs.writeFileSync(p, content, opts);
    }, (zipFs, {subPath}) => {
      return zipFs.writeFileSync(subPath, content, opts);
    });
  }

  async unlinkPromise(p: string) {
    return await this.makeCallPromise(p, async () => {
      return await this.baseFs.unlinkPromise(p);
    }, async (zipFs, {archivePath, subPath}) => {
      return await zipFs.unlinkPromise(subPath);
    });
  }

  unlinkSync(p: string) {
    return this.makeCallSync(p, () => {
      return this.baseFs.unlinkSync(p);
    }, (zipFs, {subPath}) => {
      return zipFs.unlinkSync(subPath);
    });
  }

  async utimesPromise(p: string, atime: Date | string | number, mtime: Date | string | number) {
    return await this.makeCallPromise(p, async () => {
      return await this.baseFs.utimesPromise(p, atime, mtime);
    }, async (zipFs, {subPath}) => {
      return await zipFs.utimesPromise(subPath, atime, mtime);
    });
  }

  utimesSync(p: string, atime: Date | string | number, mtime: Date | string | number) {
    return this.makeCallSync(p, () => {
      return this.baseFs.utimesSync(p, atime, mtime);
    }, (zipFs, {subPath}) => {
      return zipFs.utimesSync(subPath, atime, mtime);
    });
  }

  async mkdirPromise(p: string) {
    return await this.makeCallPromise(p, async () => {
      return await this.baseFs.mkdirPromise(p);
    }, async (zipFs, {archivePath, subPath}) => {
      return await zipFs.mkdirPromise(subPath);
    });
  }

  mkdirSync(p: string) {
    return this.makeCallSync(p, () => {
      return this.baseFs.mkdirSync(p);
    }, (zipFs, {subPath}) => {
      return zipFs.mkdirSync(subPath);
    });
  }

  async rmdirPromise(p: string) {
    return await this.makeCallPromise(p, async () => {
      return await this.baseFs.rmdirPromise(p);
    }, async (zipFs, {archivePath, subPath}) => {
      return await zipFs.rmdirPromise(subPath);
    });
  }

  rmdirSync(p: string) {
    return this.makeCallSync(p, () => {
      return this.baseFs.rmdirSync(p);
    }, (zipFs, {subPath}) => {
      return zipFs.rmdirSync(subPath);
    });
  }

  async symlinkPromise(target: string, p: string) {
    return await this.makeCallPromise(p, async () => {
      return await this.baseFs.symlinkPromise(target, p);
    }, async (zipFs, {archivePath, subPath}) => {
      return await zipFs.symlinkPromise(target, subPath);
    });
  }

  symlinkSync(target: string, p: string) {
    return this.makeCallSync(p, () => {
      return this.baseFs.symlinkSync(target, p);
    }, (zipFs, {subPath}) => {
      return zipFs.symlinkSync(target, subPath);
    });
  }

  readFilePromise(p: string, encoding?: 'utf8'): Promise<string>;
  readFilePromise(p: string, encoding?: string): Promise<Buffer>;
  async readFilePromise(p: string, encoding?: string) {
    return this.makeCallPromise(p, async () => {
      // This weird switch is required to tell TypeScript that the signatures are proper (otherwise it thinks that only the generic one is covered)
      switch (encoding) {
        case `utf8`:
          return await this.baseFs.readFilePromise(p, encoding);
        default:
          return await this.baseFs.readFilePromise(p, encoding);
      }
    }, async (zipFs, {subPath}) => {
      return await zipFs.readFilePromise(subPath, encoding);
    });
  }

  readFileSync(p: string, encoding?: 'utf8'): string;
  readFileSync(p: string, encoding?: string): Buffer;
  readFileSync(p: string, encoding?: string) {
    return this.makeCallSync(p, () => {
      // This weird switch is required to tell TypeScript that the signatures are proper (otherwise it thinks that only the generic one is covered)
      switch (encoding) {
        case `utf8`:
          return this.baseFs.readFileSync(p, encoding);
        default:
          return this.baseFs.readFileSync(p, encoding);
      }
    }, (zipFs, {subPath}) => {
      return zipFs.readFileSync(subPath, encoding);
    });
  }

  async readdirPromise(p: string) {
    return await this.makeCallPromise(p, async () => {
      return await this.baseFs.readdirPromise(p);
    }, async (zipFs, {archivePath, subPath}) => {
      return await zipFs.readdirPromise(subPath);
    }, {
      requireSubpath: false,
    });
  }

  readdirSync(p: string) {
    return this.makeCallSync(p, () => {
      return this.baseFs.readdirSync(p);
    }, (zipFs, {subPath}) => {
      return zipFs.readdirSync(subPath);
    }, {
      requireSubpath: false,
    });
  }

  async readlinkPromise(p: string) {
    return await this.makeCallPromise(p, async () => {
      return await this.baseFs.readlinkPromise(p);
    }, async (zipFs, {archivePath, subPath}) => {
      return await zipFs.readlinkPromise(subPath);
    });
  }

  readlinkSync(p: string) {
    return this.makeCallSync(p, () => {
      return this.baseFs.readlinkSync(p);
    }, (zipFs, {subPath}) => {
      return zipFs.readlinkSync(subPath);
    })
  }

  private async makeCallPromise<T>(p: string, discard: () => Promise<T>, accept: (zipFS: ZipFS, zipInfo: {archivePath: string, subPath: string}) => Promise<T>, {requireSubpath = true}: {requireSubpath?: boolean} = {}): Promise<T> {
    p = posix.normalize(posix.resolve(`/`, p));

    const zipInfo = this.findZip(p);
    if (!zipInfo)
      return await discard();
    
    if (requireSubpath && zipInfo.subPath === `/`)
      return await discard();

    return await this.getZipPromise(zipInfo.archivePath, async zipFs => await accept(zipFs, zipInfo));
  }

  private makeCallSync<T>(p: string, discard: () => T, accept: (zipFS: ZipFS, zipInfo: {archivePath: string, subPath: string}) => T, {requireSubpath = true}: {requireSubpath?: boolean} = {}): T {
    p = posix.normalize(posix.resolve(`/`, p));

    const zipInfo = this.findZip(p);
    if (!zipInfo)
      return discard();

    if (requireSubpath && zipInfo.subPath === `/`)
      return discard();

    return this.getZipSync(zipInfo.archivePath, zipFs => accept(zipFs, zipInfo));
  }

  private findZip(p: string) {
    if (this.filter && !this.filter.test(p))
      return null;

    const parts = p.split(/\//g);

    for (let t = 2; t <= parts.length; ++t) {
      const archivePath = parts.slice(0, t).join(`/`);

      if (this.notZip.has(archivePath))
        continue;

      if (this.isZip.has(archivePath))
        return {archivePath, subPath: posix.resolve(`/`, parts.slice(t).join(`/`))};

      let realArchivePath = archivePath;
      let stat;

      while (true) {
        try {
          stat = this.baseFs.lstatSync(realArchivePath);
        } catch (error) {
          return null;
        }

        if (stat.isSymbolicLink()) {
          realArchivePath = posix.resolve(posix.dirname(realArchivePath), this.baseFs.readlinkSync(realArchivePath));
        } else {
          break;
        }
      }

      const isZip = stat.isFile() && posix.extname(realArchivePath) === `.zip`;

      if (isZip) {
        this.isZip.add(archivePath);
        return {archivePath, subPath: posix.resolve(`/`, parts.slice(t).join(`/`))};
      } else {
        this.notZip.add(archivePath);
        if (stat.isFile()) {
          return null;
        }
      }
    }

    return null;
  }

  private async getZipPromise<T>(p: string, accept: (zipFs: ZipFS) => Promise<T>) {
    if (this.zipInstances) {
      let zipFs = this.zipInstances.get(p);

      if (!zipFs)
        this.zipInstances.set(p, zipFs = new ZipFS(p, {baseFs: this.baseFs, stats: await this.baseFs.statPromise(p)}));

      return await accept(zipFs);
    } else {
      const zipFs = new ZipFS(p, {baseFs: this.baseFs, stats: await this.baseFs.statPromise(p)});

      try {
        return await accept(zipFs);
      } finally {
        zipFs.saveAndClose();
      }
    }
  }

  private getZipSync<T>(p: string, accept: (zipFs: ZipFS) => T) {
    if (this.zipInstances) {
      let zipFs = this.zipInstances.get(p);

      if (!zipFs)
        this.zipInstances.set(p, zipFs = new ZipFS(p, {baseFs: this.baseFs}));

      return accept(zipFs);
    } else {
      const zipFs = new ZipFS(p, {baseFs: this.baseFs});

      try {
        return accept(zipFs);
      } finally {
        zipFs.saveAndClose();
      }
    }
  }
}
