import {FakeFS, LazyFS, NodeFS, ZipFS, PortablePath, Filename} from '@yarnpkg/fslib';
import {npath, ppath, toFilename, xfs}                         from '@yarnpkg/fslib';
import fs                                                      from 'fs';
import {tmpNameSync}                                           from 'tmp';

import {Configuration}                                         from './Configuration';
import {MessageName, ReportError}                              from './Report';
import * as hashUtils                                          from './hashUtils';
import * as structUtils                                        from './structUtils';
import {LocatorHash, Locator}                                  from './types';

// Each time we'll bump this number the cache hashes will change, which will
// cause all files to be fetched again. Use with caution.
const CACHE_VERSION = 1;

export type FetchFromCacheOptions = {
  checksums: Map<LocatorHash, Locator>,
};

export class Cache {
  public readonly configuration: Configuration;
  public readonly cwd: PortablePath;

  // Contains the list of cache files that got accessed since the last time
  // you cleared the variable. Useful to know which files aren't needed
  // anymore when used in conjunction with fetchEverything.
  public readonly markedFiles: Set<PortablePath> = new Set();

  // If true, the cache will require the cache files to exist and will never
  // forward them to the fetcher implementations (unless `check` is set)
  public readonly immutable: boolean;

  // If true, the cache will always refetch the packages and will compare their
  // checksums against both what's stored within the lockfile and what's
  // presently in the cache (unless the package isn't in the cache in the first
  // place).
  public readonly check: boolean;

  private mutexes: Map<LocatorHash, Promise<string>> = new Map();

  static async find(configuration: Configuration, {immutable, check}: {immutable?: boolean, check?: boolean} = {}) {
    const cache = new Cache(configuration.get(`cacheFolder`), {configuration, immutable, check});
    await cache.setup();

    return cache;
  }

  constructor(cacheCwd: PortablePath, {configuration, immutable = configuration.get<boolean>(`enableImmutableCache`), check = false}: {configuration: Configuration, immutable?: boolean, check?: boolean}) {
    this.configuration = configuration;
    this.cwd = cacheCwd;

    this.immutable = immutable;
    this.check = check;
  }

  get mirrorCwd() {
    if (!this.configuration.get(`enableMirror`))
      return null;

    const mirrorCwd = `${this.configuration.get(`globalFolder`)}/cache` as PortablePath;
    return mirrorCwd !== this.cwd ? mirrorCwd : null;
  }

  getLocatorFilename(locator: Locator) {
    return `${structUtils.slugifyLocator(locator)}-${CACHE_VERSION}.zip` as Filename;
  }

  getLocatorPath(locator: Locator) {
    return ppath.resolve(this.cwd, this.getLocatorFilename(locator));
  }

  getLocatorMirrorPath(locator: Locator) {
    const mirrorCwd = this.mirrorCwd;
    return mirrorCwd !== null ? ppath.resolve(mirrorCwd, this.getLocatorFilename(locator)) : null;
  }

  async setup() {
    if (!this.configuration.get(`enableGlobalCache`)) {
      await xfs.mkdirpPromise(this.cwd);

      const gitignorePath = ppath.resolve(this.cwd, toFilename(`.gitignore`));
      const gitignoreExists = await xfs.existsPromise(gitignorePath);

      if (!gitignoreExists) {
        await xfs.writeFilePromise(gitignorePath, `/.gitignore\n*.lock\n`);
      }
    }
  }

  async fetchPackageFromCache(locator: Locator, expectedChecksum: string | null, loader?: () => Promise<ZipFS>): Promise<[FakeFS<PortablePath>, () => void, string]> {
    const cachePath = this.getLocatorPath(locator);
    const mirrorPath = this.getLocatorMirrorPath(locator);

    const baseFs = new NodeFS();

    this.markedFiles.add(cachePath);

    const validateFile = async (path: PortablePath, refetchPath: PortablePath | null = null) => {
      const actualChecksum = await hashUtils.checksumFile(path);

      if (refetchPath !== null) {
        const previousChecksum = await hashUtils.checksumFile(refetchPath);
        if (actualChecksum !== previousChecksum) {
          throw new ReportError(MessageName.CACHE_CHECKSUM_MISMATCH, `The remote archive doesn't match the local checksum - has the local cache been corrupted?`);
        }
      }

      if (expectedChecksum !== null && actualChecksum !== expectedChecksum) {
        // Using --check-cache overrides any preconfigured checksum behavior
        const checksumBehavior = !this.check
          ? this.configuration.get(`checksumBehavior`)
          : `throw`;

        switch (checksumBehavior) {
          case `ignore`:
            return expectedChecksum;

          case `update`:
            return actualChecksum;

          default:
          case `throw`: {
            throw new ReportError(MessageName.CACHE_CHECKSUM_MISMATCH, `The remote archive doesn't match the expected checksum`);
          }
        }
      }

      return actualChecksum;
    };

    const validateFileAgainstRemote = async (cachePath: PortablePath) => {
      if (!loader)
        throw new Error(`Cache check required but no loader configured for ${structUtils.prettyLocator(this.configuration, locator)}`);

      const zipFs = await loader();
      const refetchPath = zipFs.getRealPath();

      zipFs.saveAndClose();

      await xfs.chmodPromise(refetchPath, 0o644);

      return await validateFile(cachePath, refetchPath);
    };

    const loadPackageThroughMirror = async () => {
      if (mirrorPath === null || !xfs.existsSync(mirrorPath))
        return await loader!();

      const tempPath = npath.toPortablePath(tmpNameSync());
      await xfs.copyFilePromise(mirrorPath, tempPath, fs.constants.COPYFILE_FICLONE);
      return new ZipFS(tempPath);
    };

    const loadPackage = async () => {
      if (!loader)
        throw new Error(`Cache entry required but missing for ${structUtils.prettyLocator(this.configuration, locator)}`);
      if (this.immutable)
        throw new ReportError(MessageName.IMMUTABLE_CACHE, `Cache entry required but missing for ${structUtils.prettyLocator(this.configuration, locator)}`);

      return await this.writeFileWithLock(cachePath, async () => {
        return await this.writeFileWithLock(mirrorPath, async () => {
          const zipFs = await loadPackageThroughMirror();
          const originalPath = zipFs.getRealPath();

          zipFs.saveAndClose();

          await xfs.chmodPromise(originalPath, 0o644);

          // Do this before moving the file so that we don't pollute the cache with corrupted archives
          const checksum = await validateFile(originalPath);

          // Doing a move is important to ensure atomic writes (todo: cross-drive?)
          await xfs.movePromise(originalPath, cachePath);

          if (mirrorPath !== null)
            await xfs.copyFilePromise(cachePath, mirrorPath, fs.constants.COPYFILE_FICLONE);

          return checksum;
        });
      });
    };

    const loadPackageThroughMutex = async () => {
      const mutex = loadPackage();
      this.mutexes.set(locator.locatorHash, mutex);

      try {
        return await mutex;
      } finally {
        this.mutexes.delete(locator.locatorHash);
      }
    };

    for (let mutex; mutex = this.mutexes.get(locator.locatorHash);)
      await mutex;

    const checksum = !baseFs.existsSync(cachePath)
      ? await loadPackageThroughMutex()
      : this.check
        ? await validateFileAgainstRemote(cachePath)
        : await validateFile(cachePath);

    let zipFs: ZipFS | null = null;

    const lazyFs: LazyFS<PortablePath> = new LazyFS<PortablePath>(() => {
      try {
        return zipFs = new ZipFS(cachePath, {readOnly: true, baseFs});
      } catch (error) {
        error.message = `Failed to open the cache entry for ${structUtils.prettyLocator(this.configuration, locator)}: ${error.message}`;
        throw error;
      }
    }, ppath);

    const releaseFs = () => {
      if (zipFs !== null) {
        zipFs.discardAndClose();
      }
    };

    return [lazyFs, releaseFs, checksum];
  }

  private async writeFileWithLock<T>(file: PortablePath | null, generator: () => Promise<T>) {
    if (file === null)
      return await generator();

    await xfs.mkdirpPromise(ppath.dirname(file));

    return await xfs.lockPromise(file, async () => {
      return await generator();
    });
  }
}
