import {xfs, ppath, PortablePath, Filename} from '@yarnpkg/fslib';

describe(`Commands`, () => {
  describe(`version apply`, () => {
    test(
      `it should apply the new version to the relevant package`,
      makeTemporaryEnv(
        {
          version: `0.0.0`,
        },
        {
          plugins: [
            require.resolve(`@yarnpkg/monorepo/scripts/plugin-version.js`),
          ],
        },
        async ({path, run}) => {
          await run(`version`, `patch`, `--deferred`);

          await expect(xfs.readJsonPromise(ppath.join(path, Filename.manifest))).resolves.toMatchObject({
            version: `0.0.0`,
          });

          await run(`version`, `apply`);

          await expect(xfs.readJsonPromise(ppath.join(path, Filename.manifest))).resolves.toMatchObject({
            version: `0.0.1`,
          });
        },
      ),
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
        {
          plugins: [
            require.resolve(`@yarnpkg/monorepo/scripts/plugin-version.js`),
          ],
        },
        async ({path, run}) => {
          const pkgA = ppath.join(path, `packages/pkg-a` as PortablePath);
          const pkgB = ppath.join(path, `packages/pkg-b` as PortablePath);

          await xfs.mkdirpPromise(pkgA);
          await xfs.mkdirpPromise(pkgB);

          await xfs.writeJsonPromise(ppath.join(pkgA, Filename.manifest), {
            name: `pkg-a`,
            version: `1.0.0`,
          });

          await xfs.writeJsonPromise(ppath.join(pkgB, Filename.manifest), {
            name: `pkg-b`,
            version: `1.0.0`,
          });

          await run(`version`, `patch`, `--deferred`, {
            cwd: pkgB,
          });

          await run(`version`, `apply`, `--all`);

          await expect(xfs.readJsonPromise(ppath.join(pkgA, Filename.manifest))).resolves.toMatchObject({
            version: `1.0.0`,
          });

          await expect(xfs.readJsonPromise(ppath.join(pkgB, Filename.manifest))).resolves.toMatchObject({
            version: `1.0.1`,
          });
        },
      ),
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
        {
          plugins: [
            require.resolve(`@yarnpkg/monorepo/scripts/plugin-version.js`),
          ],
        },
        async ({path, run}) => {
          const pkgA = ppath.join(path, `packages/pkg-a` as PortablePath);
          const pkgB = ppath.join(path, `packages/pkg-b` as PortablePath);

          await xfs.mkdirpPromise(pkgA);
          await xfs.mkdirpPromise(pkgB);

          await xfs.writeJsonPromise(ppath.join(pkgA, Filename.manifest), {
            name: `pkg-a`,
            version: `1.0.0`,
          });

          await xfs.writeJsonPromise(ppath.join(pkgB, Filename.manifest), {
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

          await expect(xfs.readJsonPromise(ppath.join(pkgA, Filename.manifest))).resolves.toMatchObject({
            version: `1.0.1`,
          });

          await expect(xfs.readJsonPromise(ppath.join(pkgB, Filename.manifest))).resolves.toMatchObject({
            version: `1.0.1`,
          });
        },
      ),
    );

    test(
      `it should apply "decline"`,
      makeTemporaryEnv(
        {
          version: `0.0.0`,
        },
        {
          plugins: [
            require.resolve(`@yarnpkg/monorepo/scripts/plugin-version.js`),
          ],
        },
        async ({path, run}) => {
          await run(`version`, `decline`, `--deferred`);

          await expect(xfs.readJsonPromise(ppath.join(path, Filename.manifest))).resolves.toMatchObject({
            version: `0.0.0`,
          });

          await run(`version`, `apply`);

          await expect(xfs.readJsonPromise(ppath.join(path, Filename.manifest))).resolves.toMatchObject({
            version: `0.0.0`,
          });
        },
      ),
    );

    test(
      `it should successfully apply a version bump that can't be described by a strategy (deferred)`,
      makeTemporaryEnv(
        {
          version: `1.0.0`,
        },
        {
          plugins: [
            require.resolve(`@yarnpkg/monorepo/scripts/plugin-version.js`),
          ],
        },
        async ({path, run}) => {
          await run(`version`, `3.4.5`, `--deferred`);

          await expect(xfs.readJsonPromise(ppath.join(path, Filename.manifest))).resolves.toMatchObject({
            version: `1.0.0`,
          });

          await run(`version`, `apply`);

          await expect(xfs.readJsonPromise(ppath.join(path, Filename.manifest))).resolves.toMatchObject({
            version: `3.4.5`,
          });
        },
      ),
    );

    const alternatives = [
      [`implicit`, `1.0.0`, true],
      [`implicit range`, `^1.0.0`, true],
      [`explicit`, `workspace:1.0.0`, true],
      [`explicit range`, `workspace:^1.0.0`, true],
    ] as const;

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
          {
            plugins: [
              require.resolve(`@yarnpkg/monorepo/scripts/plugin-version.js`),
            ],
          },
          async ({path, run}) => {
            const pkgA = ppath.join(path, `packages/pkg-a` as PortablePath);
            const pkgB = ppath.join(path, `packages/pkg-b` as PortablePath);

            await xfs.mkdirpPromise(pkgA);
            await xfs.mkdirpPromise(pkgB);

            await xfs.writeJsonPromise(ppath.join(pkgA, Filename.manifest), {
              name: `pkg-a`,
              version: `1.0.0`,
              dependencies: {
                [`pkg-b`]: dependency,
              },
            });

            await xfs.writeJsonPromise(ppath.join(pkgB, Filename.manifest), {
              name: `pkg-b`,
              version: `1.0.0`,
            });

            await run(`version`, `patch`, `--deferred`, {
              cwd: pkgB,
            });

            await run(`version`, `apply`, `--all`);

            await expect(xfs.readJsonPromise(ppath.join(pkgA, Filename.manifest))).resolves.toMatchObject({
              version: `1.0.0`,
              dependencies: {
                [`pkg-b`]: dependency.replace(/1\.0\.0/, `1.0.1`),
              },
            });

            await expect(xfs.readJsonPromise(ppath.join(pkgB, Filename.manifest))).resolves.toMatchObject({
              version: `1.0.1`,
            });
          },
        ),
      );
    }
  });
});
