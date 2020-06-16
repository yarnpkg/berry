const {
  fs: {readJson, writeJson},
  yarn: {readManifest},
} = require(`pkg-tests-core`);

describe(`Commands`, () => {
  describe(`remove`, () => {
    test(
      `it should remove a specific regular dependency amongst many`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps`]: `1.0.0`,
          [`one-fixed-dep`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`remove`, `no-deps`);

        await expect(readJson(`${path}/package.json`)).resolves.not.toHaveProperty(`dependencies.no-deps`);
      }),
    );

    test(
      `it should remove a specific development dependency amongst many`,
      makeTemporaryEnv({
        devDependencies: {
          [`no-deps`]: `1.0.0`,
          [`one-fixed-dep`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`remove`, `no-deps`);

        await expect(readJson(`${path}/package.json`)).resolves.not.toHaveProperty(`devDependencies.no-deps`);
      }),
    );

    test(
      `it should leave alone other regular dependencies`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps`]: `1.0.0`,
          [`one-fixed-dep`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`remove`, `no-deps`);

        await expect(readJson(`${path}/package.json`)).resolves.toHaveProperty(`dependencies.one-fixed-dep`);
      }),
    );

    test(
      `it should leave alone other development dependencies`,
      makeTemporaryEnv({
        devDependencies: {
          [`no-deps`]: `1.0.0`,
          [`one-fixed-dep`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`remove`, `no-deps`);

        await expect(readJson(`${path}/package.json`)).resolves.toHaveProperty(`devDependencies.one-fixed-dep`);
      }),
    );

    test(
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

    test(
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

    test(
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

    test(
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

    test(
      `it should remove all dependencies matching a glob pattern (scope & star)`,
      makeTemporaryEnv({
        dependencies: {
          [`@types/iarna__toml`]: `1.0.0`,
          [`@types/is-number`]: `1.0.0`,
          [`@types/no-deps`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`remove`, `@types/*`);

        await expect(readManifest(path)).resolves.not.toHaveProperty(`dependencies`);
      }),
    );

    test(
      `it should remove all dependencies matching a glob pattern (star)`,
      makeTemporaryEnv({
        dependencies: {
          [`dep-loop-entry`]: `1.0.0`,
          [`dep-loop-exit`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`remove`, `dep-loop-*`);

        await expect(readManifest(path)).resolves.not.toHaveProperty(`dependencies`);
      }),
    );

    test(
      `it should remove all dependencies matching a glob pattern (star-word-star)`,
      makeTemporaryEnv({
        dependencies: {
          [`dep-loop-entry`]: `1.0.0`,
          [`dep-loop-exit`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`remove`, `*loop*`);

        await expect(readManifest(path)).resolves.not.toHaveProperty(`dependencies`);
      }),
    );


    test(
      `it should remove all dependencies matching a glob pattern (braces)`,
      makeTemporaryEnv({
        dependencies: {
          [`dep-loop-entry`]: `1.0.0`,
          [`dep-loop-exit`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`remove`, `dep-loop-{entry,exit}`);

        await expect(readManifest(path)).resolves.not.toHaveProperty(`dependencies`);
      }),
    );
  });
});
