const {
  fs: {readJson, writeJson},
} = require('pkg-tests-core');

describe(`Commands`, () => {
  describe(`remove`, () => {
    test.concurrent(
      `it should remove a specific regular dependency amongst many`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps`]: `1.0.0`,
          [`one-fixed-dep`]: `1.0.0`
        },
      }, async ({path, run, source}) => {
        await run(`remove`, `no-deps`);

        await expect(readJson(`${path}/package.json`)).resolves.not.toHaveProperty(`dependencies.no-deps`);
      }),
    );

    test.concurrent(
      `it should remove a specific development dependency amongst many`,
      makeTemporaryEnv({
        devDependencies: {
          [`no-deps`]: `1.0.0`,
          [`one-fixed-dep`]: `1.0.0`
        },
      }, async ({path, run, source}) => {
        await run(`remove`, `no-deps`);

        await expect(readJson(`${path}/package.json`)).resolves.not.toHaveProperty(`devDependencies.no-deps`);
      }),
    );

    test.concurrent(
      `it should leave alone other regular dependencies`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps`]: `1.0.0`,
          [`one-fixed-dep`]: `1.0.0`
        },
      }, async ({path, run, source}) => {
        await run(`remove`, `no-deps`);

        await expect(readJson(`${path}/package.json`)).resolves.toHaveProperty(`dependencies.one-fixed-dep`);
      }),
    );

    test.concurrent(
      `it should leave alone other development dependencies`,
      makeTemporaryEnv({
        devDependencies: {
          [`no-deps`]: `1.0.0`,
          [`one-fixed-dep`]: `1.0.0`
        },
      }, async ({path, run, source}) => {
        await run(`remove`, `no-deps`);

        await expect(readJson(`${path}/package.json`)).resolves.toHaveProperty(`devDependencies.one-fixed-dep`);
      }),
    );

    test.concurrent(
      `it should remove a dependency from both regular and development environments`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps`]: `1.0.0`,
        },
        devDependencies: {
          [`no-deps`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`remove`, `no-deps`);

        const pkgJsonPromise = readJson(`${path}/package.json`);

        await expect(pkgJsonPromise).resolves.not.toHaveProperty(`dependencies.no-deps`);
        await expect(pkgJsonPromise).resolves.not.toHaveProperty(`devDependencies.no-deps`);
      }),
    );

    test.concurrent(
      `it should remove the last regular dependency from the current project`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`remove`, `no-deps`);

        await expect(readJson(`${path}/package.json`)).resolves.not.toHaveProperty(`dependencies`);
      }),
    );

    test.concurrent(
      `it should remove the last development dependency from the current project`,
      makeTemporaryEnv({
        devDependencies: {
          [`no-deps`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`remove`, `no-deps`);

        await expect(readJson(`${path}/package.json`)).resolves.not.toHaveProperty(`devDependencies`);
      }),
    );

    test.concurrent(
      `it should remove all the occurences of the specified dependency when using -A`,
      makeTemporaryEnv({
        private: true,
        workspaces: [
          `packages/*`,
        ],
      }, async ({path, run, source}) => {
        await writeJson(`${path}/packages/workspace-a/package.json`, {
          name: `workspace-a`,
          dependencies: {
            [`no-deps`]: `2.0.0`,
          },
        });

        await writeJson(`${path}/packages/workspace-b/package.json`, {
          name: `workspace-b`,
          dependencies: {
            [`no-deps`]: `2.0.0`,
          },
        });

        await writeJson(`${path}/packages/workspace-c/package.json`, {
          name: `workspace-c`,
          dependencies: {
            [`no-deps`]: `2.0.0`,
          },
        });

        await run(`remove`, `-A`, `no-deps`);

        await expect(readJson(`${path}/packages/workspace-a/package.json`)).resolves.not.toHaveProperty(`dependencies`);
        await expect(readJson(`${path}/packages/workspace-b/package.json`)).resolves.not.toHaveProperty(`dependencies`);
        await expect(readJson(`${path}/packages/workspace-c/package.json`)).resolves.not.toHaveProperty(`dependencies`);
      }),
    );
  });
});
