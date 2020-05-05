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
  });
});
