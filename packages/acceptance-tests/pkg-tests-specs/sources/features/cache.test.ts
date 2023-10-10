import {Filename, ppath, xfs} from '@yarnpkg/fslib';
import {tests}                from 'pkg-tests-core';

describe(`Cache`, () => {
  test(
    `sanity check: packages shouldn't be installable without network`,
    makeTemporaryEnv({
      dependencies: {
        [`no-deps`]: `1.0.0`,
      },
    }, async ({path, run, source}) => {
      await expect(run(`install`, {enableNetwork: false})).rejects.toThrow();
    }),
  );

  for (const enableGlobalCache of [false, true]) {
    for (const withLockfile of [false, true]) {
      test(
        `it should make packages installable even without network (${enableGlobalCache ? `global` : `local`} cache, ${withLockfile ? `with` : `without`} lockfile)`,
        makeTemporaryEnv({
          dependencies: {
            [`no-deps`]: `1.0.0`,
          },
        }, {
          enableGlobalCache,
        }, async ({path, run, source}) => {
          await run(`install`);

          if (!withLockfile)
            await xfs.removePromise(ppath.join(path, Filename.lockfile));

          const requests = await tests.startRegistryRecording(async () => {
            await run(`install`);
          });

          if (withLockfile) {
            expect(requests).toHaveLength(0);
          } else {
            expect(requests.filter(req => req.type !== tests.RequestType.PackageInfo)).toHaveLength(0);
          }
        }),
      );
    }
  }

  test(
    `it should detect when the files checksum is incorrect`,
    makeTemporaryEnv({
      dependencies: {
        [`no-deps`]: `1.0.0`,
      },
    }, async ({path, run, source}) => {
      await run(`install`);

      const cacheFiles = await xfs.readdirPromise(ppath.join(path, `.yarn/cache`));
      const cacheFile = ppath.join(path, `.yarn/cache`, cacheFiles.find(name => name.startsWith(`no-deps-`))!);

      await xfs.writeFilePromise(cacheFile, `corrupted archive`);

      await expect(run(`install`)).rejects.toThrow();
    }),
  );

  test(
    `it should detect when the files checksum is incorrect`,
    makeTemporaryEnv({
      dependencies: {
        [`no-deps`]: `1.0.0`,
      },
    }, async ({path, run, source}) => {
      await run(`install`);

      const cacheFiles = await xfs.readdirPromise(ppath.join(path, `.yarn/cache`));
      const cacheFile = ppath.join(path, `.yarn/cache`, cacheFiles.find(name => name.startsWith(`no-deps-`))!);

      await xfs.writeFilePromise(cacheFile, `corrupted archive`);

      await expect(run(`install`)).rejects.toThrow();
    }),
  );


  test(
    `it should refetch archive when YARN_CHECKSUM_BEHAVIOR=reset and the files checksum is incorrect`,
    makeTemporaryEnv({
      dependencies: {
        [`no-deps`]: `1.0.0`,
      },
    }, async ({path, run, source}) => {
      await run(`install`);

      const cacheFiles = await xfs.readdirPromise(ppath.join(path, `.yarn/cache`));
      const cacheFile = ppath.join(path, `.yarn/cache`, cacheFiles.find(name => name.startsWith(`no-deps-`))!);
      const contentWas = await xfs.readFilePromise(cacheFile);
      await xfs.writeFilePromise(cacheFile, `corrupted archive`);

      await run(`install`, {
        env: {
          YARN_CHECKSUM_BEHAVIOR: `reset`,
        },
      });

      const contentNow = await xfs.readFilePromise(cacheFile);
      expect(contentNow).toEqual(contentWas);
    }),
  );

  test(
    `it should ignore checksum mismatches and regenerate archives when their cache key is different from Yarn's own cache key, if cacheMigrationMode=always`,
    makeTemporaryEnv({
      dependencies: {
        [`no-deps`]: `1.0.0`,
      },
    }, {
      cacheMigrationMode: `always`,
    }, async ({path, run, source}) => {
      await run(`install`, {
        cacheVersionOverride: `1`,
      });

      const cacheFiles = await xfs.readdirPromise(ppath.join(path, `.yarn/cache`));
      const cacheFile = ppath.join(path, `.yarn/cache`, cacheFiles.find(name => name.startsWith(`no-deps-`))!);
      const cacheData = await xfs.readFilePromise(cacheFile);

      await xfs.writeFilePromise(cacheFile, `corrupted archive`);

      await run(`install`, {
        cacheVersionOverride: `2`,
        cacheCheckpointOverride: `1`,
      });

      await expect(xfs.readFilePromise(cacheFile)).resolves.toEqual(cacheData);
    }),
  );

  test(
    `it should ignore checksum mismatches and regenerate archives when their cache key is different from Yarn's own cache key, if cacheMigrationMode=always (global cache, hot)`,
    makeTemporaryEnv({
      dependencies: {
        [`no-deps`]: `1.0.0`,
      },
    }, {
      cacheMigrationMode: `always`,
      enableGlobalCache: true,
    }, async ({path, run, source}) => {
      await run(`install`, {
        cacheVersionOverride: `2`,
      });

      const cacheFiles = await xfs.readdirPromise(ppath.join(path, `.yarn/global/cache`));
      const cacheFile = ppath.join(path, `.yarn/global/cache`, cacheFiles.find(name => name.startsWith(`no-deps-`))!);

      // Adding some data to give it a different checksum than what we'll have for
      // "cache key v1"; zip archives allow pseudo-arbitrary content at their end
      await xfs.appendFilePromise(cacheFile, `corrupted archive`);

      // Removing the lockfile to make sure it'll be populated with "cache key v1" data
      await xfs.removePromise(ppath.join(path, Filename.lockfile));

      await run(`install`, {
        cacheVersionOverride: `1`,
      });

      await run(`install`, {
        cacheVersionOverride: `2`,
        cacheCheckpointOverride: `1`,
      });
    }),
  );

  test(
    `it should update the cache files when changing the compression level, if cacheMigrationMode=match-spec`,
    makeTemporaryEnv({
      dependencies: {
        [`no-deps`]: `1.0.0`,
      },
    }, {
      cacheMigrationMode: `match-spec`,
    }, async ({path, run, source}) => {
      await run(`install`, {
        compressionLevel: `0`,
      });

      const cacheFiles = await xfs.readdirPromise(ppath.join(path, `.yarn/cache`));
      const cacheFile = ppath.join(path, `.yarn/cache`, cacheFiles.find(name => name.startsWith(`no-deps-`))!);
      const cacheData = await xfs.readFilePromise(cacheFile);

      await run(`install`, {
        compressionLevel: `9`,
      });

      expect(xfs.existsSync(cacheFile)).toEqual(false);

      const otherCacheFiles = await xfs.readdirPromise(ppath.join(path, `.yarn/cache`));
      const otherCacheFile = ppath.join(path, `.yarn/cache`, otherCacheFiles.find(name => name.startsWith(`no-deps-`))!);

      await expect(xfs.readFilePromise(otherCacheFile)).resolves.not.toEqual(cacheData);
    }),
  );

  test(
    `it should ignore changes in the cache compression, if cacheMigrationMode=required-only`,
    makeTemporaryEnv({
      dependencies: {
        [`no-deps`]: `1.0.0`,
      },
    }, {
      cacheMigrationMode: `required-only`,
    }, async ({path, run, source}) => {
      await run(`install`, {
        compressionLevel: `0`,
      });

      const cacheFiles = await xfs.readdirPromise(ppath.join(path, `.yarn/cache`));
      const cacheFile = ppath.join(path, `.yarn/cache`, cacheFiles.find(name => name.startsWith(`no-deps-`))!);
      const cacheData = await xfs.readFilePromise(cacheFile);

      await run(`install`, {
        compressionLevel: `9`,
      });

      await expect(xfs.readFilePromise(cacheFile)).resolves.toEqual(cacheData);
    }),
  );

  test(
    `it should ignore checksum mismatches and regenerate archives when their cache key is past the threshold, if cacheMigrationMode=required-only`,
    makeTemporaryEnv({
      dependencies: {
        [`no-deps`]: `1.0.0`,
      },
    }, {
      cacheMigrationMode: `required-only`,
    }, async ({path, run, source}) => {
      await run(`install`, {
        cacheVersionOverride: `1`,
      });

      const cacheFiles = await xfs.readdirPromise(ppath.join(path, `.yarn/cache`));
      const cacheFile = ppath.join(path, `.yarn/cache`, cacheFiles.find(name => name.startsWith(`no-deps-`))!);

      await xfs.writeFilePromise(cacheFile, `corrupted archive`);

      await run(`install`, {
        cacheVersionOverride: `2`,
      });
    }),
  );

  for (const cacheMigrationMode of [`match-spec`, `required-only`]) {
    test(
      `it should enforce checksum validation when their cache key is a different version but still above the threshold, if cacheMigrationMode=${cacheMigrationMode}`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps`]: `1.0.0`,
        },
      }, {
        cacheMigrationMode,
      }, async ({path, run, source}) => {
        await run(`install`, {
          cacheVersionOverride: `1`,
        });

        const cacheFiles = await xfs.readdirPromise(ppath.join(path, `.yarn/cache`));
        const cacheFile = ppath.join(path, `.yarn/cache`, cacheFiles.find(name => name.startsWith(`no-deps-`))!);

        await xfs.writeFilePromise(cacheFile, `corrupted archive`);

        await expect(run(`install`, {
          cacheVersionOverride: `2`,
          cacheCheckpointOverride: `1`,
        })).rejects.toThrow();
      }),
    );

    test(
      `it shouldn't regenerate older archives when their cache key is a different version but still above the threshold, if cacheMigrationMode=${cacheMigrationMode}`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps`]: `1.0.0`,
        },
      }, {
        cacheMigrationMode,
      }, async ({path, run, source}) => {
        await run(`install`, {
          cacheVersionOverride: `1`,
        });

        const cacheFiles = await xfs.readdirPromise(ppath.join(path, `.yarn/cache`));
        const cacheFile = ppath.join(path, `.yarn/cache`, cacheFiles.find(name => name.startsWith(`no-deps-`))!);

        const cacheData = await xfs.readFilePromise(cacheFile);

        await run(`install`, {
          cacheVersionOverride: `2`,
          cacheCheckpointOverride: `1`,
        });

        await expect(xfs.readFilePromise(cacheFile)).resolves.toEqual(cacheData);
      }),
    );
  }

  // https://github.com/nih-at/libzip/issues/89
  // https://github.com/arcanis/libzip/commit/2fc2e1083cef164dc7e1bf112f5e6c8e165a2b5d
  test(
    `it should ignore timezones`,
    makeTemporaryEnv(
      {
        dependencies: {
          [`no-deps`]: `1.0.0`,
        },
      },
      async ({path, run, source}) => {
        await run(`install`, {
          env: {
            TZ: `Etc/GMT-0`,
          },
        });

        await expect(
          run(`install`, `--immutable`, `--immutable-cache`, `--check-cache`, {
            env: {
              TZ: `Etc/GMT-1`,
            },
          }),
        ).resolves.toMatchObject({
          code: 0,
        });
      },
    ),
  );

  // On Windows this test requires Node.js >= 16.2.0, in earlier
  // versions the `TZ` env variable is ignored / doesn't work.
  //
  // This test would ideally be a unit test for `ZipFS` but Jest
  // doesn't let us change the timezone of the current process.
  // Ref https://github.com/facebook/jest/issues/9856
  //
  // https://github.com/yarnpkg/berry/pull/1155
  // https://github.com/emscripten-core/emscripten/pull/12330
  // https://github.com/arcanis/libzip/commit/664462465d2730d51f04437c90ed7ebcbe19a36f
  test(
    `it should ignore daylight saving time (DST)`,
    makeTemporaryEnv(
      {
        dependencies: {
          // Need to use a dependency that is patched
          [`resolve`]: `1.9.0`,
        },
      },
      async ({path, run, source}) => {
        await run(`install`, {
          env: {
            TZ: `Etc/GMT-0`,
          },
        });

        await expect(
          run(`install`, `--immutable`, `--immutable-cache`, `--check-cache`, {
            env: {
              TZ: `Europe/Oslo`,
            },
          }),
        ).resolves.toMatchObject({
          code: 0,
        });

        await expect(
          run(`install`, `--immutable`, `--immutable-cache`, `--check-cache`, {
            env: {
              TZ: `Australia/Sydney`,
            },
          }),
        ).resolves.toMatchObject({
          code: 0,
        });
      },
    ),
  );
});
