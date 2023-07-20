import {Filename, ppath, xfs} from '@yarnpkg/fslib';

describe(`Commands`, () => {
  describe(`up`, () => {
    test(
      `it should bump dependency ranges to their latest`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps`]: `^1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`up`, `no-deps`);

        await expect(xfs.readJsonPromise(ppath.join(path, Filename.manifest))).resolves.toStrictEqual({
          dependencies: {
            [`no-deps`]: `^2.0.0`,
          },
        });
      }),
    );

    test(
      `it shouldn't do anything when the dependency is already the latest`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps`]: `^2.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`up`, `no-deps`);

        await expect(xfs.readJsonPromise(ppath.join(path, Filename.manifest))).resolves.toStrictEqual({
          dependencies: {
            [`no-deps`]: `^2.0.0`,
          },
        });
      }),
    );

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
      `it should upgrade all dependencies when the name is *`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps`]: `^1.0.0`,
          [`@types/is-number`]: `1.0.0`,
          [`@types/no-deps`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`up`, `*`);

        await expect(xfs.readJsonPromise(ppath.join(path, Filename.manifest))).resolves.toStrictEqual({
          dependencies: {
            [`no-deps`]: `^2.0.0`,
            [`@types/is-number`]: `^2.0.0`,
            [`@types/no-deps`]: `^2.0.0`,
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
        await run(`up`, `-F`, `no-deps@latest`);

        await expect(xfs.readJsonPromise(ppath.join(path, Filename.manifest))).resolves.toMatchObject({
          dependencies: {
            [`no-deps`]: `latest`,
          },
        });
      }),
    );

    test(
      `it should skip build scripts when using --mode=skip-build`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps-scripted`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        const {stdout} = await run(`up`, `no-deps-scripted`, `--mode=skip-build`, {
          env: {
            YARN_ENABLE_INLINE_BUILDS: `1`,
          },
        });

        expect(stdout).not.toContain(`no-deps-scripted@npm:1.0.0 must be built because it never has been before`);
        expect(stdout).not.toContain(`STDOUT preinstall out`);
      }),
    );

    test(
      `it should skip build scripts when using --mode=skip-build (recursive)`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps-scripted`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        const {stdout} = await run(`up`, `no-deps-scripted`, `--recursive`, `--mode=skip-build`, {
          env: {
            YARN_ENABLE_INLINE_BUILDS: `1`,
          },
        });

        expect(stdout).not.toContain(`no-deps-scripted@npm:1.0.0 must be built because it never has been before`);
        expect(stdout).not.toContain(`STDOUT preinstall out`);
      }),
    );
  });
});
