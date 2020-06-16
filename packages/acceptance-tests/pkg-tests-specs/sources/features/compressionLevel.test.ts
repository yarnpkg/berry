import {xfs, PortablePath, ppath} from '@yarnpkg/fslib';

function computeCacheSize(cacheDir: PortablePath): number {
  let totalSize = 0;
  const zipFilenames = xfs.readdirSync(cacheDir);
  for (const filename of zipFilenames)
    totalSize += xfs.statSync(ppath.join(cacheDir, filename)).size;

  return totalSize;
}

describe(`Features`, () => {
  describe(`Compression Level`, () => {
    test(
      `compression level 6 cache size should be less than default max compression cache size`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`various-requires`]: `1.0.0`,
          },
        },
        {
          cacheKeyOverride: undefined,
        },
        async ({path, run}) => {
          await xfs.writeFilePromise(`${path}/.yarnrc.yml` as PortablePath, ``);
          const cacheDir = `${path}/.yarn/cache` as PortablePath;

          await run(`install`);

          const levelMaxCacheSize = computeCacheSize(cacheDir);

          await xfs.writeFilePromise(`${path}/.yarnrc.yml` as PortablePath, `compressionLevel: 6\nchecksumBehavior: update\n`);

          await run(`install`);

          expect(levelMaxCacheSize).toBeLessThan(computeCacheSize(cacheDir));
        },
      ),
    );

    test(
      `compression level 0 cache size should be less than compression level 6 cache size`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`various-requires`]: `1.0.0`,
          },
        },
        {
          cacheKeyOverride: undefined,
        },
        async ({path, run}) => {
          await xfs.writeFilePromise(`${path}/.yarnrc.yml` as PortablePath, `compressionLevel: 6\n`);
          const cacheDir = `${path}/.yarn/cache` as PortablePath;

          await run(`install`);

          const level6CacheSize = computeCacheSize(cacheDir);

          await xfs.writeFilePromise(`${path}/.yarnrc.yml` as PortablePath, `compressionLevel: 0\nchecksumBehavior: update\n`);

          await run(`install`);

          expect(level6CacheSize).toBeLessThan(computeCacheSize(cacheDir));
        },
      ),
    );
  });
});
