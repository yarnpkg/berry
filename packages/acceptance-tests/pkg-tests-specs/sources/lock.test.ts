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
        dependencies: {[`no-deps`]: `patch:no-deps@^1.0.0#`},
      },
      async ({path, run, source}) => {
        await setPackageWhitelist(new Map([[`no-deps`, new Set([`1.0.0`])]]), async () => {
          await run(`install`);
        });

        const lockfilePath = ppath.join(path, Filename.lockfile);
        const lockfile = await xfs.readFilePromise(lockfilePath, `utf8`);
        const expectedLockfile = lockfile.replace(/(__metadata:[\t\r\n ]*version: )([0-9]+)/, ($0, $1, $2) => `${$1}${parseInt($2, 10) + 1}`);

        // Sanity check to be sure that the test does something
        expect(expectedLockfile).not.toEqual(lockfile);

        await setPackageWhitelist(new Map([[`no-deps`, new Set([`1.0.0`, `1.1.0`])]]), async () => {
          await run(`install`, {
            lockfileVersionOverride: LOCKFILE_VERSION + 1,
          });
        });

        await expect(xfs.readFilePromise(lockfilePath, `utf8`)).resolves.toEqual(expectedLockfile);

        await expect(source(`require('no-deps')`)).resolves.toMatchObject({
          name: `no-deps`,
          version: `1.0.0`,
        });
      },
    ),
  );
});
