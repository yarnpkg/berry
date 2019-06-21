const {
  fs: {readJson, unpackToDirectory, writeFile}
} = require('pkg-tests-core');

describe(`Plugins`, () => {
  describe(`typescript`, () => {
    test(
      `it should automatically add @types to development`,
      makeTemporaryEnv({}, async ({ path, run, source }) => {
        await writeFile(`${path}/.yarnrc.yml`, `plugins:\n  - ${JSON.stringify(require.resolve(`@berry/monorepo/scripts/plugin-typescript.js`))}\n`);
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
        await writeFile(`${path}/.yarnrc.yml`, `plugins:\n  - ${JSON.stringify(require.resolve(`@berry/monorepo/scripts/plugin-typescript.js`))}\n`);
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
        await writeFile(`${path}/.yarnrc.yml`, `plugins:\n  - ${JSON.stringify(require.resolve(`@berry/monorepo/scripts/plugin-typescript.js`))}\n`);
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
        await writeFile(`${path}/.yarnrc.yml`, `plugins:\n  - ${JSON.stringify(require.resolve(`@berry/monorepo/scripts/plugin-typescript.js`))}\n`);
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
        await writeFile(`${path}/.yarnrc.yml`, `plugins:\n  - ${JSON.stringify(require.resolve(`@berry/monorepo/scripts/plugin-typescript.js`))}\n`);
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
        await writeFile(`${path}/.yarnrc.yml`, `plugins:\n  - ${JSON.stringify(require.resolve(`@berry/monorepo/scripts/plugin-typescript.js`))}\n`);
        await run(`remove`, `@scoped/package`);

        await expect(readJson(`${path}/package.json`)).resolves.not.toHaveProperty(`devDependencies.@types/scoped__package`);
      })
    );

    test(
      `it should override types and typings in the packed manifest`,
      makeTemporaryEnv({
        types: `./types.d.ts`,
        typings: `./typings.d.ts`,
        publishConfig: {
          types: `./published-types.d.ts`,
          typings: `./published-typings.d.ts`,
        },
      }, async ({path, run, source}) => {
        await writeFile(`${path}/.yarnrc.yml`, `plugins:\n  - ${JSON.stringify(require.resolve(`@berry/monorepo/scripts/plugin-typescript.js`))}\n`);

        await run(`install`);
        await run(`pack`);

        await unpackToDirectory(path, `${path}/package.tgz`);

        const packedManifest = await readJson(`${path}/package/package.json`);

        expect(packedManifest.types).toBe(`./published-types.d.ts`);
        expect(packedManifest.typings).toBe(`./published-typings.d.ts`);

        const originalManifest = await readJson(`${path}/package.json`);

        expect(originalManifest.types).toBe(`./types.d.ts`);
        expect(originalManifest.typings).toBe(`./typings.d.ts`);
      }),
    );
  });
});
