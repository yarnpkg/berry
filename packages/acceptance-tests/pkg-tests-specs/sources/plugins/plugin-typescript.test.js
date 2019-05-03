const {
  fs: {readJson, writeFile}
} = require('pkg-tests-core');

describe(`Plugins`, () => {
  describe(`typescript`, () => {
    test(
      `it should automatically add @types to development`,
      makeTemporaryEnv({}, async ({ path, run, source }) => {
        await writeFile(`${path}/.yarnrc`, `plugins:\n  - ${JSON.stringify(require.resolve(`@berry/monorepo/scripts/plugin-typescript.js`))}\n`);
        await run(`add`, `no-deps`);

        await expect(readJson(`${path}/package.json`)).resolves.toMatchObject({
          dependencies: {
            [`no-deps`]: `^2.0.0`
          },
          devDependencies: {
            [`@types/no-deps`]: `1.0.0`
          }
        });
      })
    );

    test(
      `it should automatically add @types for scoped packages`,
      makeTemporaryEnv({}, async ({ path, run, source }) => {
        await writeFile(`${path}/.yarnrc`, `plugins:\n  - ${JSON.stringify(require.resolve(`@berry/monorepo/scripts/plugin-typescript.js`))}\n`);
        await run(`add`, `@scoped/package`);

        await expect(readJson(`${path}/package.json`)).resolves.toMatchObject({
          dependencies: {
            [`@scoped/package`]: `^1.0.0`
          },
          devDependencies: {
            [`@types/scoped__package`]: `1.0.0`
          },
        });
      })
    );

    test(
      `it should not generate a @types dependency if @types package doesn't exist`,
      makeTemporaryEnv({}, async ({ path, run, source }) => {
        await writeFile(`${path}/.yarnrc`, `plugins:\n  - ${JSON.stringify(require.resolve(`@berry/monorepo/scripts/plugin-typescript.js`))}\n`);
        await run(`add`, `resolve`);

        await expect(readJson(`${path}/package.json`)).resolves.toMatchObject({
          dependencies: {
            [`resolve`]: `^1.9.0`
          }
        });
      })
    );

    test(
      `it should not add @types for transient dependencies`,
      makeTemporaryEnv({}, async ({ path, run, source }) => {
        await writeFile(`${path}/.yarnrc`, `plugins:\n  - ${JSON.stringify(require.resolve(`@berry/monorepo/scripts/plugin-typescript.js`))}\n`);
        await run(`add`, `one-fixed-dep`);

        await expect(readJson(`${path}/package.json`)).resolves.toMatchObject({
          dependencies: {
            [`one-fixed-dep`]: `^1.0.0`
          }
        });
      })
    );

    test(
      `it should automatically remove @types from development`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps`]: `^2.0.0`
        },
        devDependencies: {
          [`@types/no-deps`]: `2.0.0`
        },
      }, async ({ path, run, source }) => {
        await writeFile(`${path}/.yarnrc`, `plugins:\n  - ${JSON.stringify(require.resolve(`@berry/monorepo/scripts/plugin-typescript.js`))}\n`);
        await run(`remove`, `no-deps`);

        await expect(readJson(`${path}/package.json`)).resolves.not.toHaveProperty(`devDependencies.@types/no-deps`);
      })
    );

    test(
      `it should automatically remove @types for scoped packages`,
      makeTemporaryEnv({
        dependencies: {
          [`@scoped/package`]: `^1.0.0`
        },
        devDependencies: {
          [`@types/scoped__package`]: `1.0.0`
        },
      }, async ({ path, run, source }) => {
        await writeFile(`${path}/.yarnrc`, `plugins:\n  - ${JSON.stringify(require.resolve(`@berry/monorepo/scripts/plugin-typescript.js`))}\n`);
        await run(`remove`, `@scoped/package`);

        await expect(readJson(`${path}/package.json`)).resolves.not.toHaveProperty(`devDependencies.@types/scoped__package`);
      })
    );
  });
});
