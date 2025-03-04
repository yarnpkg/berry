import {LOCKFILE_VERSION}     from '@yarnpkg/core';
import {Filename, ppath, xfs} from '@yarnpkg/fslib';

const {
  tests: {setPackageWhitelist},
} = require(`pkg-tests-core`);

describe(`Lock tests`, () => {
  test(
    `it should correctly lock dependencies`,
    makeTemporaryEnv(
      {
        dependencies: {[`no-deps`]: `^1.0.0`},
      },
      async ({path, run, source}) => {
        await setPackageWhitelist(new Map([[`no-deps`, new Set([`1.0.0`])]]), async () => {
          await run(`install`);
        });
        await setPackageWhitelist(new Map([[`no-deps`, new Set([`1.0.0`, `1.1.0`])]]), async () => {
          await run(`install`);
        });
        await expect(source(`require('no-deps')`)).resolves.toMatchObject({
          name: `no-deps`,
          version: `1.0.0`,
        });
      },
    ),
  );

  test(
    `it shouldn't loose track of the resolutions when upgrading the lockfile version`,
    makeTemporaryEnv(
      {
        dependencies: {[`one-range-dep`]: `1.0.0`},
      },
      async ({path, run, source}) => {
        await setPackageWhitelist(new Map([[`no-deps`, new Set([`1.0.0`])]]), async () => {
          await run(`install`);
        });

        await expect(source(`require('one-range-dep')`)).resolves.toMatchObject({
          name: `one-range-dep`,
          version: `1.0.0`,
          dependencies: {
            [`no-deps`]: {
              name: `no-deps`,
              version: `1.0.0`,
            },
          },
        });

        await setPackageWhitelist(new Map([[`no-deps`, new Set([`1.0.0`, `1.1.0`])]]), async () => {
          await run(`install`, {
            lockfileVersionOverride: LOCKFILE_VERSION + 1,
          });
        });

        await expect(source(`require('one-range-dep')`)).resolves.toMatchObject({
          name: `one-range-dep`,
          version: `1.0.0`,
          dependencies: {
            [`no-deps`]: {
              name: `no-deps`,
              version: `1.0.0`,
            },
          },
        });

        await xfs.rmPromise(ppath.join(path, Filename.lockfile));

        await setPackageWhitelist(new Map([[`no-deps`, new Set([`1.0.0`, `1.1.0`])]]), async () => {
          await run(`install`, {
            lockfileVersionOverride: LOCKFILE_VERSION + 2,
          });
        });

        await expect(source(`require('one-range-dep')`)).resolves.toMatchObject({
          name: `one-range-dep`,
          version: `1.0.0`,
          dependencies: {
            [`no-deps`]: {
              name: `no-deps`,
              version: `1.1.0`,
            },
          },
        });
      },
    ),
  );
});
