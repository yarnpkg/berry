import {yarn} from 'pkg-tests-core';

const {readManifest} = yarn;

describe(`Commands`, () => {
  describe(`up`, () => {
    test(
      `it should upgrade all dependencies matching a glob pattern (scope & star)`,
      makeTemporaryEnv({
        dependencies: {
          [`@types/is-number`]: `1.0.0`,
          [`@types/no-deps`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`up`, `@types/*`);

        await expect(readManifest(path)).resolves.toStrictEqual({
          dependencies: {
            [`@types/is-number`]: `^2.0.0`,
            [`@types/no-deps`]: `^2.0.0`,
          },
        });
      }),
    );

    test(
      `it should upgrade all dependencies matching a glob pattern (scope & star & range)`,
      makeTemporaryEnv({
        dependencies: {
          [`@types/is-number`]: `2.0.0`,
          [`@types/no-deps`]: `2.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`up`, `@types/*@1.0.0`);

        await expect(readManifest(path)).resolves.toStrictEqual({
          dependencies: {
            [`@types/is-number`]: `1.0.0`,
            [`@types/no-deps`]: `1.0.0`,
          },
        });
      }),
    );
  });
});
