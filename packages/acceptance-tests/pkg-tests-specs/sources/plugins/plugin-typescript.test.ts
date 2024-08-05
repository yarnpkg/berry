import {Manifest}                 from '@yarnpkg/core';
import {PortablePath, ppath, xfs} from '@yarnpkg/fslib';
import {merge}                    from 'lodash';
import {fs, yarn}                 from 'pkg-tests-core';

const {unpackToDirectory} = fs;
const {readManifest} = yarn;

describe(`Plugins`, () => {
  describe(`typescript`, () => {
    describe(`Adding types`, () => {
      test(
        `it shouldn't be enabled by default`,
        makeTemporaryEnv({}, async ({path, run, source}) => {
          await run(`add`, `is-number`);

          const manifestPromise = readManifest(path);

          await expect(manifestPromise).resolves.toMatchObject({
            dependencies: {
              [`is-number`]: `^2.0.0`,
            },
          });

          await expect(manifestPromise).not.toHaveProperty(`devDependencies`);
        }),
      );

      test(
        `it should automatically enable automatic @types insertion when a tsconfig is detected at the root of the project`,
        makeTemporaryEnv({}, async ({path, run, source}) => {
          await xfs.writeFilePromise(ppath.join(path, `tsconfig.json`), ``);

          await run(`add`, `is-number`);

          await expect(readManifest(path)).resolves.toMatchObject({
            dependencies: {
              [`is-number`]: `^2.0.0`,
            },
            devDependencies: {
              [`@types/is-number`]: `^2`,
            },
          });
        }),
      );

      test(
        `it should automatically enable automatic @types insertion when a tsconfig is detected in the current workspace`,
        makeTemporaryMonorepoEnv({
          workspaces: [`packages/*`],
        }, {[`packages/foo`]: {}}, async ({path, run, source}) => {
          await xfs.writeFilePromise(ppath.join(path, `packages/foo/tsconfig.json`), ``);

          await run(`add`, `is-number`, {
            cwd: `${path}/packages/foo` as PortablePath,
          });

          await expect(readManifest(`${path}/packages/foo` as PortablePath)).resolves.toMatchObject({
            dependencies: {
              [`is-number`]: `^2.0.0`,
            },
            devDependencies: {
              [`@types/is-number`]: `^2`,
            },
          });
        }),
      );

      test(
        `it should automatically enable automatic @types insertion in the current workspace when tsEnableAutoTypes is set to true`,
        makeTemporaryMonorepoEnv({
          workspaces: [`packages/*`],
        }, {[`packages/foo`]: {}}, async ({path, run, source}) => {
          await run(`config`, `set`, `tsEnableAutoTypes`, `true`);

          await run(`add`, `is-number`, {
            cwd: `${path}/packages/foo` as PortablePath,
          });

          await expect(readManifest(`${path}/packages/foo` as PortablePath)).resolves.toMatchObject({
            dependencies: {
              [`is-number`]: `^2.0.0`,
            },
            devDependencies: {
              [`@types/is-number`]: `^2`,
            },
          });
        }),
      );

      test(
        `it should not automatically enable automatic @types insertion when a tsconfig is present in a sibling workspace`,
        makeTemporaryMonorepoEnv({
          workspaces: [`packages/*`],
        }, {[`packages/foo`]: {}, [`packages/bar`]: {}}, async ({path, run, source}) => {
          await xfs.writeFilePromise(ppath.join(path, `packages/foo/tsconfig.json`), ``);

          await run(`add`, `is-number`, {
            cwd: `${path}/packages/bar` as PortablePath,
          });

          await expect(readManifest(`${path}/packages/bar` as PortablePath)).resolves.toMatchObject({
            dependencies: {
              [`is-number`]: `^2.0.0`,
            },
          });
        }),
      );

      test(
        `it should automatically enable automatic @types insertion when a tsconfig is detected in the root project of the current workspace`,
        makeTemporaryMonorepoEnv({
          workspaces: [`packages/*`],
        }, {[`packages/foo`]: {}}, async ({path, run, source}) => {
          await xfs.writeFilePromise(ppath.join(path, `tsconfig.json`), ``);

          await run(`add`, `is-number`, {
            cwd: `${path}/packages/foo` as PortablePath,
          });

          await expect(readManifest(`${path}/packages/foo` as PortablePath)).resolves.toMatchObject({
            dependencies: {
              [`is-number`]: `^2.0.0`,
            },
            devDependencies: {
              [`@types/is-number`]: `^2`,
            },
          });
        }),
      );

      test(
        `it should automatically add @types to devDependencies when package doesn't provide types`,
        makeTemporaryEnv({}, {
          tsEnableAutoTypes: true,
        }, async ({path, run, source}) => {
          await run(`add`, `is-number`);

          await expect(readManifest(path)).resolves.toMatchObject({
            dependencies: {
              [`is-number`]: `^2.0.0`,
            },
            devDependencies: {
              [`@types/is-number`]: `^2`,
            },
          });
        }),
      );

      test(
        `it should not add @types when package provides its own types`,
        makeTemporaryEnv({}, {
          tsEnableAutoTypes: true,
        }, async ({path, run, source}) => {
          await run(`add`, `left-pad`);

          await expect(readManifest(path)).resolves.toMatchObject({
            dependencies: {
              [`left-pad`]: `^1.0.0`,
            },
          });
        }),
      );

      test(
        `it should automatically add @types for scoped packages`,
        makeTemporaryEnv({}, {
          tsEnableAutoTypes: true,
        }, async ({path, run, source}) => {
          await run(`add`, `@babel/traverse@7.99.0`);

          await expect(readManifest(path)).resolves.toMatchObject({
            dependencies: {
              [`@babel/traverse`]: `7.99.0`,
            },
            devDependencies: {
              [`@types/babel__traverse`]: `^7`,
            },
          });
        }),
      );

      test(
        `it should not generate a @types dependency if @types package doesn't exist`,
        makeTemporaryEnv({}, {
          tsEnableAutoTypes: true,
        }, async ({path, run, source}) => {
          await run(`add`, `resolve`);

          await expect(readManifest(path)).resolves.toMatchObject({
            dependencies: {
              [`resolve`]: `^1.9.0`,
            },
          });
        }),
      );

      test(
        `it should not add @types for transient dependencies`,
        makeTemporaryEnv({}, {
          tsEnableAutoTypes: true,
        }, async ({path, run, source}) => {
          await run(`add`, `one-fixed-dep-with-types`);

          await expect(readManifest(path)).resolves.toMatchObject({
            dependencies: {
              [`one-fixed-dep-with-types`]: `^1.0.0`,
            },
          });
        }),
      );

      test(
        `it should add @types with the range '^<original-major>' by default`,
        makeTemporaryEnv({}, {
          tsEnableAutoTypes: true,
        }, async ({path, run, source}) => {
          await run(`add`, `is-number@^1.0.0`);

          await expect(readManifest(path)).resolves.toMatchObject({
            dependencies: {
              [`is-number`]: `^1.0.0`,
            },
            devDependencies: {
              [`@types/is-number`]: `^1`,
            },
          });
        }),
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
        }, {
          tsEnableAutoTypes: true,
        }, async ({path, run, source}) => {
          await run(`add`, `is-number@^2.0.0`);

          await expect(readManifest(path)).resolves.toMatchObject({
            dependencies: {
              [`is-number`]: `^2.0.0`,
            },
            devDependencies: {
              [`@types/is-number`]: `1.0.0`,
            },
          });
        }),
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
        }, {
          tsEnableAutoTypes: true,
        }, async ({path, run, source}) => {
          await run(`add`, `is-number@^2.0.0`);

          await expect(readManifest(path)).resolves.toMatchObject({
            dependencies: {
              [`is-number`]: `^2.0.0`,
            },
            devDependencies: {
              [`@types/is-number`]: `1.0.0`,
            },
          });
        }),
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
        }, {
          tsEnableAutoTypes: true,
        }, async ({path, run, source}) => {
          await run(`add`, `is-number@^2.0.0`);

          await expect(readManifest(path)).resolves.toMatchObject({
            dependencies: {
              [`is-number`]: `^2.0.0`,
            },
            devDependencies: {
              [`@types/is-number`]: `^2`,
            },
          });
        }),
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
        }, {
          tsEnableAutoTypes: true,
        }, async ({path, run, source}) => {
          await run(`add`, `is-number@^1.0.0`);

          await expect(readManifest(path)).resolves.toMatchObject({
            dependencies: {
              [`is-number`]: `^1.0.0`,
            },
          });
        }),
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
        }, {
          tsEnableAutoTypes: true,
        }, async ({path, run, source}) => {
          await run(`add`, `is-number@^2.0.0`);

          await expect(readManifest(path)).resolves.toMatchObject({
            dependencies: {
              [`is-number`]: `^2.0.0`,
            },
            devDependencies: {
              [`@types/is-number`]: `1.0.0`,
            },
          });
        }),
      );
    });

    describe(`Removing types`, () => {
      for (const type of Manifest.allDependencies) {
        test(
          `it should not automatically remove @types from ${type} without tsconfig or tsEnableAutoTypes`,
          makeTemporaryEnv(merge({
            dependencies: {
              [`is-number`]: `^1.0.0`,
            },
          }, {
            [type]: {
              [`@types/is-number`]: `1.0.0`,
            },
          }), {}, async ({path, run, source}) => {
            await run(`remove`, `is-number`);

            await expect(readManifest(path)).resolves.toHaveProperty(`${type}.@types/is-number`);
          }),
        );

        test(
          `it should automatically remove @types from ${type} with tsEnableAutoTypes set to true`,
          makeTemporaryEnv(merge({
            dependencies: {
              [`is-number`]: `^1.0.0`,
            },
          }, {
            [type]: {
              [`@types/is-number`]: `1.0.0`,
            },
          }), {
            tsEnableAutoTypes: true,
          }, async ({path, run, source}) => {
            await run(`remove`, `is-number`);

            await expect(readManifest(path)).resolves.not.toHaveProperty(`${type}.@types/is-number`);
          }),
        );

        test(
          `it should automatically remove @types from ${type} with tsconfig.json present`,
          makeTemporaryEnv(merge({
            dependencies: {
              [`is-number`]: `^1.0.0`,
            },
          }, {
            [type]: {
              [`@types/is-number`]: `1.0.0`,
            },
          }), {}, async ({path, run, source}) => {
            await xfs.writeFilePromise(ppath.join(path, `tsconfig.json`), ``);

            await run(`remove`, `is-number`);

            await expect(readManifest(path)).resolves.not.toHaveProperty(`${type}.@types/is-number`);
          }),
        );

        test(
          `it should not automatically remove @types ${type} from the current workspace without tsconfig.json present or tsEnableAutoTypes`,
          makeTemporaryMonorepoEnv({
            workspaces: [`packages/*`],
          },
          merge(
            {[`packages/foo`]: {dependencies: {[`is-number`]: `^1.0.0`}}},
            {[`packages/foo`]: {[type]: {[`@types/is-number`]: `1.0.0`}}},
          ),
          async ({path, run, source}) => {
            await run(`remove`, `is-number`, {
              cwd: `${path}/packages/foo` as PortablePath,
            });

            await expect(readManifest(`${path}/packages/foo` as PortablePath)).resolves.toHaveProperty(`${type}.@types/is-number`);
          }),
        );

        test(
          `it should automatically remove @types ${type} from the current workspace when a tsconfig is detected in the root project of the current workspace`,
          makeTemporaryMonorepoEnv({
            workspaces: [`packages/*`],
          },
          merge(
            {[`packages/foo`]: {dependencies: {[`is-number`]: `^1.0.0`}}},
            {[`packages/foo`]: {[type]: {[`@types/is-number`]: `1.0.0`}}},
          ),
          async ({path, run, source}) => {
            await xfs.writeFilePromise(ppath.join(path, `tsconfig.json`), ``);

            await run(`remove`, `is-number`, {
              cwd: `${path}/packages/foo` as PortablePath,
            });

            await expect(readManifest(`${path}/packages/foo` as PortablePath)).resolves.not.toHaveProperty(`${type}.@types/is-number`);
          }),
        );

        test(
          `it should automatically remove @types ${type} from the current workspace with tsEnableAutoTypes set to true`,
          makeTemporaryMonorepoEnv({
            workspaces: [`packages/*`],
          },
          merge(
            {[`packages/foo`]: {dependencies: {[`is-number`]: `^1.0.0`}}},
            {[`packages/foo`]: {[type]: {[`@types/is-number`]: `1.0.0`}}},
          ),
          async ({path, run, source}) => {
            await run(`config`, `set`, `tsEnableAutoTypes`, `true`);
            await run(`remove`, `is-number`, {
              cwd: `${path}/packages/foo` as PortablePath,
            });

            await expect(readManifest(`${path}/packages/foo` as PortablePath)).resolves.not.toHaveProperty(`${type}.@types/is-number`);
          }),
        );

        test(
          `it should automatically remove @types ${type} from the current workspace with tsconfig.json present`,
          makeTemporaryMonorepoEnv({
            workspaces: [`packages/*`],
          },
          merge(
            {[`packages/foo`]: {dependencies: {[`is-number`]: `^1.0.0`}}},
            {[`packages/foo`]: {[type]: {[`@types/is-number`]: `1.0.0`}}},
          ),
          async ({path, run, source}) => {
            await xfs.writeFilePromise(ppath.join(path, `packages/foo/tsconfig.json`), ``);

            await run(`remove`, `is-number`, {
              cwd: `${path}/packages/foo` as PortablePath,
            });

            await expect(readManifest(`${path}/packages/foo` as PortablePath)).resolves.not.toHaveProperty(`${type}.@types/is-number`);
          }),
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
        }, {
          tsEnableAutoTypes: true,
        }, async ({path, run, source}) => {
          await run(`remove`, `@iarna/toml`);

          await expect(readManifest(path)).resolves.not.toHaveProperty(`devDependencies.@types/iarna__toml`);
        }),
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
