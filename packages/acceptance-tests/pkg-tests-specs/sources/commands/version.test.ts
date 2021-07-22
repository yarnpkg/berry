import {xfs, ppath, PortablePath, Filename} from '@yarnpkg/fslib';

const {
  fs: {readJson},
} = require(`pkg-tests-core`);

describe(`Commands`, () => {
  describe(`version check`, () => {
    test(
      `it shouldn't work if the strategy isn't semver and there is no prior version`,
      makeTemporaryEnv({}, {
        plugins: [
          require.resolve(`@yarnpkg/monorepo/scripts/plugin-version.js`),
        ],
      }, async ({path, run, source}) => {
        await expect(run(`version`, `patch`)).rejects.toThrow();
      }),
    );

    test(
      `it shouldn't work if the immediate bump would be lower than the planned version (semver strategy)`,
      makeTemporaryEnv({
        version: `1.0.0`,
      }, {
        plugins: [
          require.resolve(`@yarnpkg/monorepo/scripts/plugin-version.js`),
        ],
      }, async ({path, run, source}) => {
        await run(`version`, `1.1.0`, `--deferred`);
        await expect(run(`version`, `1.0.1`)).rejects.toThrow();
      }),
    );

    test(
      `it shouldn't work if the immediate bump would be lower than the planned version (incremental strategy)`,
      makeTemporaryEnv({
        version: `1.0.0`,
      }, {
        plugins: [
          require.resolve(`@yarnpkg/monorepo/scripts/plugin-version.js`),
        ],
      }, async ({path, run, source}) => {
        await run(`version`, `1.1.0`, `--deferred`);
        await expect(run(`version`, `patch`)).rejects.toThrow();
      }),
    );

    test(
      `it should work if the immediate bump is greater than the planned version (semver strategy)`,
      makeTemporaryEnv({
        version: `1.0.0`,
      }, {
        plugins: [
          require.resolve(`@yarnpkg/monorepo/scripts/plugin-version.js`),
        ],
      }, async ({path, run, source}) => {
        await run(`version`, `1.1.0`, `--deferred`);
        await run(`version`, `2.0.0`);

        await expect(readJson(`${path}/package.json`)).resolves.toMatchObject({
          version: `2.0.0`,
        });
      }),
    );

    test(
      `it should work if the immediate bump is greater than the planned version (incremental strategy)`,
      makeTemporaryEnv({
        version: `1.0.0`,
      }, {
        plugins: [
          require.resolve(`@yarnpkg/monorepo/scripts/plugin-version.js`),
        ],
      }, async ({path, run, source}) => {
        await run(`version`, `1.1.0`, `--deferred`);
        await run(`version`, `major`);

        await expect(readJson(`${path}/package.json`)).resolves.toMatchObject({
          version: `2.0.0`,
        });
      }),
    );

    test(
      `it should work if the immediate bump is equal to the planned version (semver strategy)`,
      makeTemporaryEnv({
        version: `1.0.0`,
      }, {
        plugins: [
          require.resolve(`@yarnpkg/monorepo/scripts/plugin-version.js`),
        ],
      }, async ({path, run, source}) => {
        await run(`version`, `1.1.0`, `--deferred`);
        await run(`version`, `1.1.0`);

        await expect(readJson(`${path}/package.json`)).resolves.toMatchObject({
          version: `1.1.0`,
        });
      }),
    );

    test(
      `it should work if the immediate bump is equal to the planned version (incremental strategy)`,
      makeTemporaryEnv({
        version: `1.0.0`,
      }, {
        plugins: [
          require.resolve(`@yarnpkg/monorepo/scripts/plugin-version.js`),
        ],
      }, async ({path, run, source}) => {
        await run(`version`, `1.1.0`, `--deferred`);
        await run(`version`, `minor`);

        await expect(readJson(`${path}/package.json`)).resolves.toMatchObject({
          version: `1.1.0`,
        });
      }),
    );

    test(
      `it should increase the version number for a workspace`,
      makeTemporaryEnv({
        version: `0.0.0`,
      }, {
        plugins: [
          require.resolve(`@yarnpkg/monorepo/scripts/plugin-version.js`),
        ],
      }, async ({path, run, source}) => {
        await run(`version`, `patch`);

        await expect(readJson(`${path}/package.json`)).resolves.toMatchObject({
          version: `0.0.1`,
        });
      }),
    );

    test(
      `it shouldn't immediatly increase the version number for a workspace when using --deferred`,
      makeTemporaryEnv({
        version: `0.0.0`,
      }, {
        plugins: [
          require.resolve(`@yarnpkg/monorepo/scripts/plugin-version.js`),
        ],
      }, async ({path, run, source}) => {
        await run(`version`, `patch`, `--deferred`);

        await expect(readJson(`${path}/package.json`)).resolves.toMatchObject({
          version: `0.0.0`,
        });

        await run(`version`, `apply`);

        await expect(readJson(`${path}/package.json`)).resolves.toMatchObject({
          version: `0.0.1`,
        });
      }),
    );

    test(
      `it shouldn't immediatly increase the version number for a workspace when using preferDeferredVersions`,
      makeTemporaryEnv({
        version: `0.0.0`,
      }, {
        preferDeferredVersions: true,
        plugins: [
          require.resolve(`@yarnpkg/monorepo/scripts/plugin-version.js`),
        ],
      }, async ({path, run, source}) => {
        await run(`version`, `patch`);

        await expect(readJson(`${path}/package.json`)).resolves.toMatchObject({
          version: `0.0.0`,
        });

        await run(`version`, `apply`);

        await expect(readJson(`${path}/package.json`)).resolves.toMatchObject({
          version: `0.0.1`,
        });
      }),
    );

    test(
      `it should immediatly increase the version number for a workspace when using --immediate, even if preferDeferredVersions is set`,
      makeTemporaryEnv({
        version: `0.0.0`,
      }, {
        preferDeferredVersions: true,
        plugins: [
          require.resolve(`@yarnpkg/monorepo/scripts/plugin-version.js`),
        ],
      }, async ({path, run, source}) => {
        await run(`version`, `patch`, `--immediate`);

        await expect(readJson(`${path}/package.json`)).resolves.toMatchObject({
          version: `0.0.1`,
        });
      }),
    );

    test(
      `it should correctly report a dependent workspace when unable to upgrade its version.`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [
            `packages/*`,
          ],
        },
        {
          plugins: [
            require.resolve(`@yarnpkg/monorepo/scripts/plugin-version.js`),
          ],
        },
        async ({path, run, source}) => {
          // Create the primary package.
          const pkgPrimary = ppath.join(path, `packages/pkg-primary` as PortablePath);
          await xfs.mkdirpPromise(pkgPrimary);
          await xfs.writeJsonPromise(ppath.join(pkgPrimary, Filename.manifest), {
            name: `pkg-primary`,
            version: `1.0.0`,
          });

          // Create the dependant package.
          const pkgDependant = ppath.join(path, `packages/pkg-dependant` as PortablePath);
          await xfs.mkdirpPromise(pkgDependant);
          await xfs.writeJsonPromise(ppath.join(pkgDependant, Filename.manifest), {
            name: `pkg-dependant`,
            version: `1.0.0`,
            dependencies: {
              [`pkg-primary`]: `workspace:*`,
            },
          });

          await run(`install`);

          expect(run(`workspace`, `pkg-primary`, `version`, `patch`)).resolves.toMatchObject({
            code: 0,
            stdout: expect.stringContaining(`Couldn't auto-upgrade range * (in pkg-dependant@workspace:packages/pkg-dependant)`),
          });
        }),
    );

    test(
      `it should throw when applying an invalid strategy`,
      makeTemporaryEnv({
        version: `1.0.0`,
      }, {
        plugins: [
          require.resolve(`@yarnpkg/monorepo/scripts/plugin-version.js`),
        ],
      }, async ({path, run, source}) => {
        await expect(run(`version`, `invalid`)).rejects.toThrow(`Invalid value for enumeration: "invalid"`);
      }),
    );

    test(
      `it should throw when applying an invalid strategy on top of the stored version`,
      makeTemporaryEnv({
        version: `1.0.0`,
      }, {
        plugins: [
          require.resolve(`@yarnpkg/monorepo/scripts/plugin-version.js`),
        ],
      }, async ({path, run, source}) => {
        await run(`version`, `major`, `--deferred`);

        await expect(run(`version`, `invalid`)).rejects.toThrow(`Invalid value for enumeration: "invalid"`);
      }),
    );

    test(
      `it should throw when applying an invalid strategy (deferred)`,
      makeTemporaryEnv({
        version: `1.0.0`,
      }, {
        plugins: [
          require.resolve(`@yarnpkg/monorepo/scripts/plugin-version.js`),
        ],
      }, async ({path, run, source}) => {
        await expect(run(`version`, `invalid`, `--deferred`)).rejects.toThrow(`Invalid value for enumeration: "invalid"`);
      }),
    );
  });
});
