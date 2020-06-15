import {xfs} from '@yarnpkg/fslib';

const {
  fs: {createTemporaryFolder, writeJson},
  tests: {getPackageDirectoryPath},
} = require(`pkg-tests-core`);

describe(`Protocols`, () => {
  describe(`portal:`, () => {
    test(
      `it should link a remote location into the current dependency tree`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps`]: getPackageDirectoryPath(`no-deps`, `1.0.0`).then(dirPath => `link:${dirPath}`),
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        await expect(source(`require('no-deps/package.json')`)).resolves.toMatchObject({
          name: `no-deps`,
          version: `1.0.0`,
        });
      }),
    );

    test(
      `it should ignore links' own dependencies`,
      makeTemporaryEnv({
        dependencies: {
          [`one-fixed-dep`]: getPackageDirectoryPath(`one-fixed-dep`, `1.0.0`).then(dirPath => `link:${dirPath}`),
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        await expect(source(`require('one-fixed-dep')`)).rejects.toMatchObject({
          externalException: {
            code: `MODULE_NOT_FOUND`,
            pnpCode: `UNDECLARED_DEPENDENCY`,
          },
        });
      }),
    );

    test(
      `it should work even when the target doesn't have a manifest`,
      makeTemporaryEnv(
        {},
        async ({path, run, source}) => {
          const tmp = await createTemporaryFolder();

          await writeJson(`${tmp}/data.json`, {
            data: 42,
          });

          await writeJson(`${path}/package.json`, {
            dependencies: {
              [`foo`]: `link:${tmp}`,
            },
          });

          await run(`install`);

          await expect(source(`require('foo/data.json')`)).resolves.toMatchObject({
            data: 42,
          });
        },
      ),
    );

    test(
      `it shouldn't cause the paths to be discarded when covered by other fetchers (alphabetical before)`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`a-my-app`]: `link:.`,
            [`no-deps`]: `1.0.0`,
          },
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
      `it shouldn't cause the paths to be discarded when covered by other fetchers (alphabetical after)`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`no-deps`]: `1.0.0`,
            [`z-my-app`]: `link:.`,
          },
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
      `it should allow link to access their containers' dependencies`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps`]: `1.0.0`,
          [`foo`]: `link:./my-dir`,
        },
      }, {
        pnpFallbackMode: `none`,
      }, async ({path, run, source}) => {
        await xfs.mkdirPromise(`${path}/my-dir`);
        await xfs.writeFilePromise(`${path}/my-dir/index.js`, `module.exports = require('no-deps');\n`);

        await run(`install`);

        await expect(source(`require('foo')`)).resolves.toMatchObject({
          name: `no-deps`,
          version: `1.0.0`,
        });
      }),
    );
  });
});
