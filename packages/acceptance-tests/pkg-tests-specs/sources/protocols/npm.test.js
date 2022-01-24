import {xfs} from '@yarnpkg/fslib';

describe(`Protocols`, () => {
  describe(`npm:`, () => {
    test(
      `it should allow renaming packages`,
      makeTemporaryEnv(
        {
          dependencies: {[`no-deps`]: `npm:one-fixed-dep@1.0.0`},
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(source(`require('no-deps')`)).resolves.toMatchObject({
            name: `one-fixed-dep`,
            version: `1.0.0`,
          });
        },
      ),
    );

    test(
      `it should allow prefixing semver ranges with "v"`,
      makeTemporaryEnv(
        {
          dependencies: {[`no-deps`]: `npm:v1.0.0`},
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(source(`require('no-deps')`)).resolves.toMatchObject({
            name: `no-deps`,
            version: `1.0.0`,
          });
        },
      ),
    );

    test(
      `it should allow semver ranges with build metadata`,
      makeTemporaryEnv(
        {
          dependencies: {[`no-deps-build-metadata`]: `npm:1.0.0+123`},
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(source(`require('no-deps-build-metadata')`)).resolves.toMatchObject({
            name: `no-deps-build-metadata`,
            version: `1.0.0+123`,
          });
        },
      ),
    );

    test(
      `it should allow fetching packages that have an unconventional url (semver)`,
      makeTemporaryEnv(
        {
          dependencies: {[`unconventional-tarball`]: `1.0.0`},
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(source(`require('unconventional-tarball')`)).resolves.toMatchObject({
            name: `unconventional-tarball`,
            version: `1.0.0`,
          });

          await xfs.removePromise(`${path}/.yarn`);
          await run(`install`);
        },
      ),
    );

    test(
      `it should allow fetching packages that have an unconventional url (tag)`,
      makeTemporaryEnv(
        {
          dependencies: {[`unconventional-tarball`]: `latest`},
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(source(`require('unconventional-tarball')`)).resolves.toMatchObject({
            name: `unconventional-tarball`,
            version: `1.0.0`,
          });

          await xfs.removePromise(`${path}/.yarn`);
          await run(`install`);
        },
      ),
    );

    test(
      `it should allow fetching packages that have an unconventional url without specifying version`,
      makeTemporaryEnv({}, async ({run, source}) => {
        await run(`add`, `unconventional-tarball`);

        await expect(source(`require('unconventional-tarball')`)).resolves.toMatchObject({
          name: `unconventional-tarball`,
          version: `1.0.0`,
        });
      }),
    );
  });
});
