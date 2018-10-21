import {posix}  from 'path';

import {FakeFS} from './FakeFS';
import {ZipFS}  from './ZipFS';

export type ZipOpenFSOptions = {
  baseFs: FakeFS,
};

export class ZipOpenFS extends FakeFS {
  private readonly baseFs: FakeFS;

  private readonly zipInstances: Map<string, ZipFS> = new Map();

  private reentrant: boolean = false;

  private isZip: Set<string> = new Set();
  private notZip: Set<string> = new Set();

  constructor({baseFs}: ZipOpenFSOptions) {
    super();

    this.baseFs = baseFs;

    this.isZip = new Set();
    this.notZip = new Set();
  }

  getRealPath() {
    return this.baseFs.getRealPath();
  }

  createReadStream(p: string, opts: {encoding?: string}) {
    return this.makeCall(p, () => {
      return this.baseFs.createReadStream(p, opts);
    }, (zipFs, {subPath}) => {
      return zipFs.createReadStream(subPath);
    });
  }

  realpath(p: string) {
    return this.makeCall(p, () => {
      return this.baseFs.realpath(p);
    }, (zipFs, {archivePath, subPath}) => {
      return posix.resolve(archivePath, posix.relative(`/`, zipFs.realpath(subPath)));
    });
  }

  readdir(p: string) {
    return this.makeCall(p, () => {
      return this.baseFs.readdir(p);
    }, (zipFs, {subPath}) => {
      return zipFs.readdir(subPath);
    });
  }

  exists(p: string) {
    return this.makeCall(p, () => {
      return this.baseFs.exists(p);
    }, (zipFs, {subPath}) => {
      return zipFs.exists(subPath);
    });
  }

  readlink(p: string) {
    return this.makeCall(p, () => {
      return this.baseFs.readlink(p);
    }, (zipFs, {subPath}) => {
      return zipFs.readlink(subPath);
    })
  }

  stat(p: string) {
    return this.makeCall(p, () => {
      return this.baseFs.stat(p);
    }, (zipFs, {subPath}) => {
      return zipFs.stat(subPath);
    });
  }

  lstat(p: string) {
    return this.makeCall(p, () => {
      return this.baseFs.lstat(p);
    }, (zipFs, {subPath}) => {
      return zipFs.lstat(subPath);
    });
  }

  mkdir(p: string) {
    return this.makeCall(p, () => {
      return this.baseFs.mkdir(p);
    }, (zipFs, {subPath}) => {
      return zipFs.mkdir(subPath);
    });
  }

  writeFile(p: string, content: Buffer | string) {
    return this.makeCall(p, () => {
      return this.baseFs.writeFile(p, content);
    }, (zipFs, {subPath}) => {
      return zipFs.writeFile(subPath, content);
    });
  }

  readFile(p: string, encoding?: 'utf8'): string;
  readFile(p: string, encoding?: string): Buffer;
  readFile(p: string, encoding?: string) {
    return this.makeCall(p, () => {
      // This weird switch is required to tell TypeScript that the signatures are proper (otherwise it thinks that only the generic one is covered)
      switch (encoding) {
        case `utf8`:
          return this.baseFs.readFile(p, encoding);
        default:
          return this.baseFs.readFile(p, encoding);
      }
    }, (zipFs, {subPath}) => {
      return zipFs.readFile(subPath, encoding);
    });
  }

  private makeCall<T>(p: string, discard: () => T, accept: (zipFS: ZipFS, zipInfo: {archivePath: string, subPath: string}) => T): T {
    if (this.reentrant)
      return discard();

    const zipInfo = this.findZip(p);

    if (!zipInfo)
      return discard();

    this.reentrant = true;

    try {
      return accept(this.getZip(zipInfo.archivePath), zipInfo);
    } finally {
      this.reentrant = false;
    }
  }

  private findZip(p: string) {
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
          stat = this.baseFs.lstat(realArchivePath);
        } catch (error) {
          return null;
        }

        if (stat.isSymbolicLink()) {
          realArchivePath = posix.resolve(posix.dirname(realArchivePath), this.baseFs.readlink(realArchivePath));
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

  private getZip(p: string) {
    let zipFs = this.zipInstances.get(p);

    if (!zipFs)
      this.zipInstances.set(p, zipFs = new ZipFS(p, {baseFs: this}));

    return zipFs;
  }
}
