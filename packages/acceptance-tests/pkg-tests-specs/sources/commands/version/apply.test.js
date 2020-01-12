import {xfs, ppath} from '@yarnpkg/fslib';

describe(`Commands`, () => {
  describe(`version apply`, () => {
    test(
      `it should apply the new version to the relevant package`,
      makeTemporaryEnv(
        {
          version: `0.0.0`,
        },
        async ({path, run}) => {
          await run(`version`, `patch`, `--deferred`);

          await expect(xfs.readJsonPromise(ppath.join(path, `package.json`))).resolves.toMatchObject({
            version: `0.0.0`,
          });

          await run(`version`, `apply`);

          await expect(xfs.readJsonPromise(ppath.join(path, `package.json`))).resolves.toMatchObject({
            version: `0.0.1`,
          });
        }
      )
    );

    test(
      `it should only apply the new version to the relevant packages`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [
            `packages/*`,
          ],
        },
        async ({path, run}) => {
          const pkgA = ppath.join(path, `packages/pkg-a`);
          const pkgB = ppath.join(path, `packages/pkg-b`);

          await xfs.mkdirpPromise(pkgA);
          await xfs.mkdirpPromise(pkgB);

          await xfs.writeJsonPromise(ppath.join(pkgA, `package.json`), {
            name: `pkg-a`,
            version: `1.0.0`,
          });

          await xfs.writeJsonPromise(ppath.join(pkgB, `package.json`), {
            name: `pkg-b`,
            version: `1.0.0`,
          });

          await run(`version`, `patch`, `--deferred`, {
            cwd: pkgB,
          });

          await run(`version`, `apply`, `--all`);

          await expect(xfs.readJsonPromise(ppath.join(pkgA, `package.json`))).resolves.toMatchObject({
            version: `1.0.0`,
          });

          await expect(xfs.readJsonPromise(ppath.join(pkgB, `package.json`))).resolves.toMatchObject({
            version: `1.0.1`,
          });
        }
      )
    );

    test(
      `it should apply the new version to multiple packages if needed`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [
            `packages/*`,
          ],
        },
        async ({path, run}) => {
          const pkgA = ppath.join(path, `packages/pkg-a`);
          const pkgB = ppath.join(path, `packages/pkg-b`);

          await xfs.mkdirpPromise(pkgA);
          await xfs.mkdirpPromise(pkgB);

          await xfs.writeJsonPromise(ppath.join(pkgA, `package.json`), {
            name: `pkg-a`,
            version: `1.0.0`,
          });

          await xfs.writeJsonPromise(ppath.join(pkgB, `package.json`), {
            name: `pkg-b`,
            version: `1.0.0`,
          });

          await run(`version`, `patch`, `--deferred`, {
            cwd: pkgA,
          });

          await run(`version`, `patch`, `--deferred`, {
            cwd: pkgB,
          });

          await run(`version`, `apply`, `--all`);

          await expect(xfs.readJsonPromise(ppath.join(pkgA, `package.json`))).resolves.toMatchObject({
            version: `1.0.1`,
          });

          await expect(xfs.readJsonPromise(ppath.join(pkgB, `package.json`))).resolves.toMatchObject({
            version: `1.0.1`,
          });
        }
      )
    );

    const alternatives = [
      [`implicit`, `1.0.0`, true],
      [`implicit range`, `^1.0.0`, true],
      [`explicit`, `workspace:1.0.0`, true],
      [`explicit range`, `workspace:^1.0.0`, true],
    ];

    for (const [name, dependency] of alternatives) {
      test(
        `it should auto-update the dependencies (${name})`,
        makeTemporaryEnv(
          {
            private: true,
            workspaces: [
              `packages/*`,
            ],
          },
          async ({path, run}) => {
            const pkgA = ppath.join(path, `packages/pkg-a`);
            const pkgB = ppath.join(path, `packages/pkg-b`);

            await xfs.mkdirpPromise(pkgA);
            await xfs.mkdirpPromise(pkgB);

            await xfs.writeJsonPromise(ppath.join(pkgA, `package.json`), {
              name: `pkg-a`,
              version: `1.0.0`,
              dependencies: {
                [`pkg-b`]: dependency,
              },
            });

            await xfs.writeJsonPromise(ppath.join(pkgB, `package.json`), {
              name: `pkg-b`,
              version: `1.0.0`,
            });

            await run(`version`, `patch`, `--deferred`, {
              cwd: pkgB,
            });

            await run(`version`, `apply`, `--all`);

            await expect(xfs.readJsonPromise(ppath.join(pkgA, `package.json`))).resolves.toMatchObject({
              version: `1.0.0`,
              dependencies: {
                [`pkg-b`]: dependency.replace(/1\.0\.0/, `1.0.1`),
              },
            });

            await expect(xfs.readJsonPromise(ppath.join(pkgB, `package.json`))).resolves.toMatchObject({
              version: `1.0.1`,
            });
          }
        )
      );
    }
  });
});
