import {Manifest}     from '@yarnpkg/core';
import {PortablePath} from '@yarnpkg/fslib';
import {merge}        from 'lodash';
import {fs, yarn}     from 'pkg-tests-core';

const {unpackToDirectory} = fs;
const {writeConfiguration, readManifest} = yarn;

describe(`Plugins`, () => {
  describe(`typescript`, () => {
    describe(`Adding types`, () => {
      test(
        `it should automatically add @types to devDependencies when package doesn't provide types`,
        makeTemporaryEnv({}, async ({path, run, source}) => {
          await writeConfiguration(path, {plugins: [require.resolve(`@yarnpkg/monorepo/scripts/plugin-typescript.js`)]});
          await run(`add`, `is-number`);

          await expect(readManifest(path)).resolves.toMatchObject({
            dependencies: {
              [`is-number`]: `^2.0.0`,
            },
            devDependencies: {
              [`@types/is-number`]: `^2`,
            },
          });
        })
      );

      test(
        `it should not add @types when package provides its own types`,
        makeTemporaryEnv({}, async ({path, run, source}) => {
          await writeConfiguration(path, {plugins: [require.resolve(`@yarnpkg/monorepo/scripts/plugin-typescript.js`)]});
          await run(`add`, `left-pad`);

          await expect(readManifest(path)).resolves.toMatchObject({
            dependencies: {
              [`left-pad`]: `^1.0.0`,
            },
          });
        })
      );

      test(
        `it should automatically add @types for scoped packages`,
        makeTemporaryEnv({}, async ({path, run, source}) => {
          await writeConfiguration(path, {plugins: [require.resolve(`@yarnpkg/monorepo/scripts/plugin-typescript.js`)]});
          await run(`add`, `@iarna/toml`);

          await expect(readManifest(path)).resolves.toMatchObject({
            dependencies: {
              [`@iarna/toml`]: `^1.0.0`,
            },
            devDependencies: {
              [`@types/iarna__toml`]: `^1`,
            },
          });
        })
      );

      test(
        `it should not generate a @types dependency if @types package doesn't exist`,
        makeTemporaryEnv({}, async ({path, run, source}) => {
          await writeConfiguration(path, {plugins: [require.resolve(`@yarnpkg/monorepo/scripts/plugin-typescript.js`)]});
          await run(`add`, `resolve`);

          await expect(readManifest(path)).resolves.toMatchObject({
            dependencies: {
              [`resolve`]: `^1.9.0`,
            },
          });
        })
      );

      test(
        `it should not add @types for transient dependencies`,
        makeTemporaryEnv({}, async ({path, run, source}) => {
          await writeConfiguration(path, {plugins: [require.resolve(`@yarnpkg/monorepo/scripts/plugin-typescript.js`)]});
          await run(`add`, `one-fixed-dep-with-types`);

          await expect(readManifest(path)).resolves.toMatchObject({
            dependencies: {
              [`one-fixed-dep-with-types`]: `^1.0.0`,
            },
          });
        })
      );

      test(
        `it should add @types with the range '^<original-major>' by default`,
        makeTemporaryEnv({}, async ({path, run, source}) => {
          await writeConfiguration(path, {plugins: [require.resolve(`@yarnpkg/monorepo/scripts/plugin-typescript.js`)]});
          await run(`add`, `is-number@^1.0.0`);

          await expect(readManifest(path)).resolves.toMatchObject({
            dependencies: {
              [`is-number`]: `^1.0.0`,
            },
            devDependencies: {
              [`@types/is-number`]: `^1`,
            },
          });
        })
      );

      test(
        `it should reuse ranges when adding @types if the ranges of the original descriptor match (basic)`,
        makeTemporaryMonorepoEnv({
          workspaces: [`A`],
        }, {
          A: {
            dependencies: {
              [`is-number`]: `^2.0.0`,
            },
            devDependencies: {
              [`@types/is-number`]: `1.0.0`,
            },
          },
        }, async ({path, run, source}) => {
          await writeConfiguration(path, {plugins: [require.resolve(`@yarnpkg/monorepo/scripts/plugin-typescript.js`)]});

          await run(`add`, `is-number@^2.0.0`);

          await expect(readManifest(path)).resolves.toMatchObject({
            dependencies: {
              [`is-number`]: `^2.0.0`,
            },
            devDependencies: {
              [`@types/is-number`]: `1.0.0`,
            },
          });
        })
      );

      test(
        `it should reuse ranges when adding @types if the ranges of the original descriptor match (nested workspaces)`,
        makeTemporaryMonorepoEnv({
          workspaces: [`A`],
        }, {
          A: {
            workspaces: [`B`],
          },
          'A/B': {
            dependencies: {
              [`is-number`]: `^2.0.0`,
            },
            devDependencies: {
              [`@types/is-number`]: `1.0.0`,
            },
          },
        }, async ({path, run, source}) => {
          await writeConfiguration(path, {plugins: [require.resolve(`@yarnpkg/monorepo/scripts/plugin-typescript.js`)]});

          await run(`add`, `is-number@^2.0.0`);

          await expect(readManifest(path)).resolves.toMatchObject({
            dependencies: {
              [`is-number`]: `^2.0.0`,
            },
            devDependencies: {
              [`@types/is-number`]: `1.0.0`,
            },
          });
        })
      );

      test(
        `it shouldn't reuse ranges when adding @types if the ranges of the original descriptor don't match`,
        makeTemporaryMonorepoEnv({
          workspaces: [`A`],
        }, {
          A: {
            dependencies: {
              [`is-number`]: `^1.0.0`,
            },
            devDependencies: {
              [`@types/is-number`]: `1.0.0`,
            },
          },
        }, async ({path, run, source}) => {
          await writeConfiguration(path, {plugins: [require.resolve(`@yarnpkg/monorepo/scripts/plugin-typescript.js`)]});

          await run(`add`, `is-number@^2.0.0`);

          await expect(readManifest(path)).resolves.toMatchObject({
            dependencies: {
              [`is-number`]: `^2.0.0`,
            },
            devDependencies: {
              [`@types/is-number`]: `^2`,
            },
          });
        })
      );

      test(
        `it should add @types with the range '^<original-major>' if the ranges of the original descriptor match, but the @types aren't installed`,
        makeTemporaryMonorepoEnv({
          workspaces: [`A`],
        }, {
          A: {
            dependencies: {
              [`is-number`]: `^1.0.0`,
            },
          },
        }, async ({path, run, source}) => {
          await writeConfiguration(path, {plugins: [require.resolve(`@yarnpkg/monorepo/scripts/plugin-typescript.js`)]});

          await run(`add`, `is-number@^1.0.0`);

          await expect(readManifest(path)).resolves.toMatchObject({
            dependencies: {
              [`is-number`]: `^1.0.0`,
            },
          });
        })
      );

      test(
        `it should reuse the range from the first workspace (sorted alphabetically) when adding @types if the ranges of the original descriptor match`,
        makeTemporaryMonorepoEnv({
          workspaces: [`A`, `B`],
        }, {
          A: {
            dependencies: {
              [`is-number`]: `^2.0.0`,
            },
            devDependencies: {
              [`@types/is-number`]: `1.0.0`,
            },
          },
          B: {
            dependencies: {
              [`is-number`]: `^2.0.0`,
            },
            devDependencies: {
              [`@types/is-number`]: `2.0.0`,
            },
          },
        }, async ({path, run, source}) => {
          await writeConfiguration(path, {plugins: [require.resolve(`@yarnpkg/monorepo/scripts/plugin-typescript.js`)]});

          await run(`add`, `is-number@^2.0.0`);

          await expect(readManifest(path)).resolves.toMatchObject({
            dependencies: {
              [`is-number`]: `^2.0.0`,
            },
            devDependencies: {
              [`@types/is-number`]: `1.0.0`,
            },
          });
        })
      );
    });

    describe(`Removing types`, () => {
      for (const type of Manifest.allDependencies) {
        test(
          `it should automatically remove @types from ${type}`,
          makeTemporaryEnv(merge({
            dependencies: {
              [`is-number`]: `^1.0.0`,
            },
          }, {
            [type]: {
              [`@types/is-number`]: `1.0.0`,
            },
          }), async ({path, run, source}) => {
            await writeConfiguration(path, {plugins: [require.resolve(`@yarnpkg/monorepo/scripts/plugin-typescript.js`)]});
            await run(`remove`, `is-number`);

            await expect(readManifest(path)).resolves.not.toHaveProperty(`${type}.@types/is-number`);
          })
        );
      }

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
          await writeConfiguration(path, {plugins: [require.resolve(`@yarnpkg/monorepo/scripts/plugin-typescript.js`)]});
          await run(`remove`, `@iarna/toml`);

          await expect(readManifest(path)).resolves.not.toHaveProperty(`devDependencies.@types/iarna__toml`);
        })
      );
    });

    describe(`publishConfig`, () => {
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
          await writeConfiguration(path, {plugins: [require.resolve(`@yarnpkg/monorepo/scripts/plugin-typescript.js`)]});

          await run(`install`);
          await run(`pack`);

          await unpackToDirectory(path, `${path}/package.tgz` as PortablePath);

          const packedManifest = await readManifest(`${path}/package` as PortablePath);

          expect(packedManifest.types).toBe(`./published-types.d.ts`);
          expect(packedManifest.typings).toBe(`./published-typings.d.ts`);

          const originalManifest = await readManifest(path);

          expect(originalManifest.types).toBe(`./types.d.ts`);
          expect(originalManifest.typings).toBe(`./typings.d.ts`);
        }),
      );
    });
  });
});
