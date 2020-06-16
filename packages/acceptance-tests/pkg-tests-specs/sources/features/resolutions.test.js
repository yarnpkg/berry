import {xfs} from '@yarnpkg/fslib';

const {
  fs: {writeFile, writeJson},
  tests: {getPackageArchivePath, getPackageDirectoryPath},
} = require(`pkg-tests-core`);

describe(`Features`, () => {
  describe(`Resolutions`, () => {
    test(
      `it should support overriding packages with portals`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`one-fixed-dep`]: `1.0.0`,
          },
          resolutions: {
            [`no-deps`]: `portal:./my-package`,
          },
        },
        async ({path, run, source}) => {
          await writeFile(`${path}/my-package/index.js`, `module.exports = 42;\n`);
          await writeJson(`${path}/my-package/package.json`, {
            name: `no-deps`,
            version: `42.0.0`,
          });

          await run(`install`);

          await expect(source(`require('one-fixed-dep')`)).resolves.toMatchObject({
            name: `one-fixed-dep`,
            version: `1.0.0`,
            dependencies: {
              [`no-deps`]: 42,
            },
          });
        },
      ),
    );

    test(
      `it should error when legacy glob syntax is used`,
      makeTemporaryEnv(
        {
          resolutions: {
            [`**/no-deps`]: `1.2.0`,
          },
        },
        async ({path, run, source}) => {
          const {stdout} = await run(`install`);

          expect(stdout).toContain(`YN0057`);
        },
      ),
    );

    test(
      `it should support overriding packages with tarballs`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`one-fixed-dep`]: `1.0.0`,
          },
          resolutions: {
            [`no-deps`]: getPackageArchivePath(`no-deps`, `2.0.0`),
          },
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(source(`require('one-fixed-dep')`)).resolves.toMatchObject({
            name: `one-fixed-dep`,
            version: `1.0.0`,
            dependencies: {
              [`no-deps`]: {
                name: `no-deps`,
                version: `2.0.0`,
              },
            },
          });
        },
      ),
    );

    test(
      `it should support overriding packages with directories`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`one-fixed-dep`]: `1.0.0`,
          },
          resolutions: {
            [`no-deps`]: getPackageDirectoryPath(`no-deps`, `2.0.0`),
          },
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(source(`require('one-fixed-dep')`)).resolves.toMatchObject({
            name: `one-fixed-dep`,
            version: `1.0.0`,
            dependencies: {
              [`no-deps`]: {
                name: `no-deps`,
                version: `2.0.0`,
              },
            },
          });
        },
      ),
    );

    test(
      `it should detect that a resolution entry got removed`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`one-fixed-dep`]: `1.0.0`,
          },
          resolutions: {
            [`no-deps`]: getPackageDirectoryPath(`no-deps`, `2.0.0`),
          },
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(source(`require('one-fixed-dep')`)).resolves.toMatchObject({
            name: `one-fixed-dep`,
            version: `1.0.0`,
            dependencies: {
              [`no-deps`]: {
                name: `no-deps`,
                version: `2.0.0`,
              },
            },
          });

          await xfs.writeJsonPromise(`${path}/package.json`, {
            dependencies: {
              [`one-fixed-dep`]: `1.0.0`,
            },
          });

          await run(`install`);

          await expect(source(`require('one-fixed-dep')`)).resolves.toMatchObject({
            name: `one-fixed-dep`,
            version: `1.0.0`,
            dependencies: {
              [`no-deps`]: {
                name: `no-deps`,
                version: `1.0.0`,
              },
            },
          });
        },
      ),
    );
  });
});
