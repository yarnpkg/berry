import os                                     from 'os';

import {NodeFS}                               from './NodeFS';
import {Filename, PortablePath, npath, ppath} from './path';

function getTempName(prefix: string) {
  const hash = Math.ceil(Math.random() * 0x100000000).toString(16).padStart(8, `0`);

  return `${prefix}${hash}` as Filename;
}

export type XFS = NodeFS & {
  detachTemp(p: PortablePath): void;

  mktempSync(): PortablePath;
  mktempSync<T>(cb: (p: PortablePath) => T): T;

  mktempPromise(): Promise<PortablePath>;
  mktempPromise<T>(cb: (p: PortablePath) => Promise<T>): Promise<T>;

  /**
   * Tries to remove all temp folders created by mktempSync and mktempPromise
   */
  rmtempPromise(): Promise<void>;

  /**
   * Tries to remove all temp folders created by mktempSync and mktempPromise
   */
  rmtempSync(): void;
};

const tmpdirs = new Set<PortablePath>();

let tmpEnv: {
  tmpdir: PortablePath;
  realTmpdir: PortablePath;
} | null = null;

function initTmpEnv() {
  if (tmpEnv)
    return tmpEnv;

  const tmpdir = npath.toPortablePath(os.tmpdir());
  const realTmpdir = xfs.realpathSync(tmpdir);

  process.once(`exit`, () => {
    xfs.rmtempSync();
  });

  return tmpEnv = {
    tmpdir,
    realTmpdir,
  };
}

export const xfs: XFS = Object.assign(new NodeFS(), {
  detachTemp(p: PortablePath) {
    tmpdirs.delete(p);
  },

  mktempSync<T>(this: XFS, cb?: (p: PortablePath) => T) {
    const {tmpdir, realTmpdir} = initTmpEnv();

    while (true) {
      const name = getTempName(`xfs-`);

      try {
        this.mkdirSync(ppath.join(tmpdir, name));
      } catch (error) {
        if (error.code === `EEXIST`) {
          continue;
        } else {
          throw error;
        }
      }

      const realP = ppath.join(realTmpdir, name);
      tmpdirs.add(realP);

      if (typeof cb === `undefined`)
        return realP;

      try {
        return cb(realP);
      } finally {
        if (tmpdirs.has(realP)) {
          tmpdirs.delete(realP);
          try {
            this.removeSync(realP);
          } catch {
            // Too bad if there's an error
          }
        }
      }
    }
  },

  async mktempPromise<T>(this: XFS, cb?: (p: PortablePath) => Promise<T>) {
    const {tmpdir, realTmpdir} = initTmpEnv();

    while (true) {
      const name = getTempName(`xfs-`);

      try {
        await this.mkdirPromise(ppath.join(tmpdir, name));
      } catch (error) {
        if (error.code === `EEXIST`) {
          continue;
        } else {
          throw error;
        }
      }

      const realP = ppath.join(realTmpdir, name);
      tmpdirs.add(realP);

      if (typeof cb === `undefined`)
        return realP;

      try {
        return await cb(realP);
      } finally {
        if (tmpdirs.has(realP)) {
          tmpdirs.delete(realP);
          try {
            await this.removePromise(realP);
          } catch {
            // Too bad if there's an error
          }
        }
      }
    }
  },

  async rmtempPromise() {
    await Promise.all(Array.from(tmpdirs.values()).map(async p => {
      try {
        await xfs.removePromise(p, {maxRetries: 0});
        tmpdirs.delete(p);
      } catch {
        // Too bad if there's an error
      }
    }));
  },

  rmtempSync() {
    for (const p of tmpdirs) {
      try {
        xfs.removeSync(p);
        tmpdirs.delete(p);
      } catch {
        // Too bad if there's an error
      }
    }
  },
});
