import {Filename, ppath, xfs} from '@yarnpkg/fslib';

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

        await expect(xfs.readJsonPromise(ppath.join(path, Filename.manifest))).resolves.toStrictEqual({
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

        await expect(xfs.readJsonPromise(ppath.join(path, Filename.manifest))).resolves.toStrictEqual({
          dependencies: {
            [`@types/is-number`]: `1.0.0`,
            [`@types/no-deps`]: `1.0.0`,
          },
        });
      }),
    );

    test(
      `it should upgrade regular dependencies to the current project (resolved tag)`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`up`, `no-deps@latest`);

        await expect(xfs.readJsonPromise(ppath.join(path, Filename.manifest))).resolves.toMatchObject({
          dependencies: {
            [`no-deps`]: `^2.0.0`,
          },
        });
      }),
    );

    test(
      `it should upgrade regular dependencies to the current project (fixed tag)`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`add`, `-F`, `no-deps@latest`);

        await expect(xfs.readJsonPromise(ppath.join(path, Filename.manifest))).resolves.toMatchObject({
          dependencies: {
            [`no-deps`]: `latest`,
          },
        });
      }),
    );
  });
});
