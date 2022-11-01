import {ppath, xfs} from '@yarnpkg/fslib';

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

  test(
    `it should make packages installable even without network`,
    makeTemporaryEnv({
      dependencies: {
        [`no-deps`]: `1.0.0`,
      },
    }, async ({path, run, source}) => {
      await run(`install`);
      await run(`install`, {enableNetwork: false});
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
      const cacheFile = ppath.join(path, `.yarn/cache`, cacheFiles.find(name => name.startsWith(`no-deps-`)));

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
      const cacheFile = ppath.join(path, `.yarn/cache`, cacheFiles.find(name => name.startsWith(`no-deps-`)));

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
      const cacheFile = ppath.join(path, `.yarn/cache`, cacheFiles.find(name => name.startsWith(`no-deps-`)));
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
    `it should ignore mismatches when the cache key changes`,
    makeTemporaryEnv({
      dependencies: {
        [`no-deps`]: `1.0.0`,
      },
    }, async ({path, run, source}) => {
      await run(`install`, {
        cacheKeyOverride: `1`,
      });

      const cacheFiles = await xfs.readdirPromise(ppath.join(path, `.yarn/cache`));
      const cacheFile = ppath.join(path, `.yarn/cache`, cacheFiles.find(name => name.startsWith(`no-deps-`)));

      await xfs.writeFilePromise(cacheFile, `corrupted archive`);

      await run(`install`, {
        cacheKeyOverride: `2`,
      });
    }),
  );

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
