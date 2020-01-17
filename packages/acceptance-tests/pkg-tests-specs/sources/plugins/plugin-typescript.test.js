const {
  fs: {readJson, unpackToDirectory, writeFile},
} = require('pkg-tests-core');

describe(`Plugins`, () => {
  describe(`typescript`, () => {
    test(
      `it should automatically add @types to devDependencies when package doesn't provide types`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await writeFile(`${path}/.yarnrc.yml`, `plugins:\n  - ${JSON.stringify(require.resolve(`@yarnpkg/monorepo/scripts/plugin-typescript.js`))}\n`);
        await run(`add`, `is-number`);

        await expect(readJson(`${path}/package.json`)).resolves.toMatchObject({
          dependencies: {
            [`is-number`]: `^1.0.0`,
          },
          devDependencies: {
            [`@types/is-number`]: `1.0.0`,
          },
        });
      })
    );

    test(
      `it should not add @types when package provides its own types`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await writeFile(`${path}/.yarnrc.yml`, `plugins:\n  - ${JSON.stringify(require.resolve(`@yarnpkg/monorepo/scripts/plugin-typescript.js`))}\n`);
        await run(`add`, `left-pad`);

        await expect(readJson(`${path}/package.json`)).resolves.toMatchObject({
          dependencies: {
            [`left-pad`]: `^1.0.0`,
          },
        });
      })
    );

    test(
      `it should automatically add @types for scoped packages`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await writeFile(`${path}/.yarnrc.yml`, `plugins:\n  - ${JSON.stringify(require.resolve(`@yarnpkg/monorepo/scripts/plugin-typescript.js`))}\n`);
        await run(`add`, `@iarna/toml`);

        await expect(readJson(`${path}/package.json`)).resolves.toMatchObject({
          dependencies: {
            [`@iarna/toml`]: `^1.0.0`,
          },
          devDependencies: {
            [`@types/iarna__toml`]: `1.0.0`,
          },
        });
      })
    );

    test(
      `it should not generate a @types dependency if @types package doesn't exist`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await writeFile(`${path}/.yarnrc.yml`, `plugins:\n  - ${JSON.stringify(require.resolve(`@yarnpkg/monorepo/scripts/plugin-typescript.js`))}\n`);
        await run(`add`, `resolve`);

        await expect(readJson(`${path}/package.json`)).resolves.toMatchObject({
          dependencies: {
            [`resolve`]: `^1.9.0`,
          },
        });
      })
    );

    test(
      `it should not add @types for transient dependencies`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await writeFile(`${path}/.yarnrc.yml`, `plugins:\n  - ${JSON.stringify(require.resolve(`@yarnpkg/monorepo/scripts/plugin-typescript.js`))}\n`);
        await run(`add`, `one-fixed-dep-with-types`);

        await expect(readJson(`${path}/package.json`)).resolves.toMatchObject({
          dependencies: {
            [`one-fixed-dep-with-types`]: `^1.0.0`,
          },
        });
      })
    );

    test(
      `it should automatically remove @types from devDependencies`,
      makeTemporaryEnv({
        dependencies: {
          [`is-number`]: `^1.0.0`,
        },
        devDependencies: {
          [`@types/is-number`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await writeFile(`${path}/.yarnrc.yml`, `plugins:\n  - ${JSON.stringify(require.resolve(`@yarnpkg/monorepo/scripts/plugin-typescript.js`))}\n`);
        await run(`remove`, `is-number`);

        await expect(readJson(`${path}/package.json`)).resolves.not.toHaveProperty(`devDependencies.@types/is-number`);
      })
    );

    test(
      `it should automatically remove @types for scoped packages`,
      makeTemporaryEnv({
        dependencies: {
          [`@iarna/toml`]: `^1.0.0`,
        },
        devDependencies: {
          [`@types/iarna__toml`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await writeFile(`${path}/.yarnrc.yml`, `plugins:\n  - ${JSON.stringify(require.resolve(`@yarnpkg/monorepo/scripts/plugin-typescript.js`))}\n`);
        await run(`remove`, `@iarna/toml`);

        await expect(readJson(`${path}/package.json`)).resolves.not.toHaveProperty(`devDependencies.@types/iarna__toml`);
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
        await writeFile(`${path}/.yarnrc.yml`, `plugins:\n  - ${JSON.stringify(require.resolve(`@yarnpkg/monorepo/scripts/plugin-typescript.js`))}\n`);

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
