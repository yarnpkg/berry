import {ppath, xfs} from '@yarnpkg/fslib';

describe(`Commands`, () => {
  describe(`workspaces focus`, () => {
    test(
      `should install the dependencies for the focused workspace only`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`packages/*`],
        },
        async ({path, run}) => {
          await setupProject(path);

          await run(`install`);

          const cacheFolder = ppath.join(path, `.yarn/cache`);
          await xfs.removePromise(cacheFolder);

          await run(`workspaces`, `focus`, {
            cwd: ppath.join(path, `packages/foo`),
          });

          await expect(xfs.readdirPromise(cacheFolder)).resolves.toEqual([
            `.gitignore`,
            expect.stringContaining(`no-deps-npm-1.0.0-`),
          ]);
        }
      )
    );

    test(
      `should install the dependencies for specified workspaces only`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`packages/*`],
        },
        async ({path, run}) => {
          await setupProject(path);

          await run(`install`);

          const cacheFolder = ppath.join(path, `.yarn/cache`);
          await xfs.removePromise(cacheFolder);

          await run(`workspaces`, `focus`, `foo`, `bar`, {
            cwd: ppath.join(path, `packages/foo`),
          });

          await expect(xfs.readdirPromise(cacheFolder)).resolves.toEqual([
            `.gitignore`,
            expect.stringContaining(`no-deps-npm-1.0.0-`),
            expect.stringContaining(`no-deps-npm-2.0.0-`),
          ]);
        }
      )
    );

    test(
      `should follow local workspace dependencies`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`packages/*`],
        },
        async ({path, run}) => {
          await setupProject(path);

          await run(`install`);

          const cacheFolder = ppath.join(path, `.yarn/cache`);
          await xfs.removePromise(cacheFolder);

          await run(`workspaces`, `focus`, {
            cwd: ppath.join(path, `packages/baz`),
          });

          await expect(xfs.readdirPromise(cacheFolder)).resolves.toEqual([
            `.gitignore`,
            expect.stringContaining(`no-deps-npm-2.0.0-`),
          ]);
        }
      )
    );

    test(
      `should install development dependencies by default`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`packages/*`],
        },
        async ({path, run}) => {
          await setupProject(path);

          await run(`install`);

          const cacheFolder = ppath.join(path, `.yarn/cache`);
          await xfs.removePromise(cacheFolder);

          await run(`workspaces`, `focus`, `qux`, {
            cwd: path,
          });

          await expect(xfs.readdirPromise(cacheFolder)).resolves.toEqual([
            `.gitignore`,
            expect.stringContaining(`no-deps-bins-npm-1.0.0-`),
            expect.stringContaining(`no-deps-npm-1.0.0-`),
          ]);
        }
      )
    );

    test(
      `should only install production dependencies if requested`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`packages/*`],
        },
        async ({path, run}) => {
          await setupProject(path);

          await run(`install`);

          const cacheFolder = ppath.join(path, `.yarn/cache`);
          await xfs.removePromise(cacheFolder);

          await run(`workspaces`, `focus`, `qux`, `--production`, {
            cwd: path,
          });

          await expect(xfs.readdirPromise(cacheFolder)).resolves.toEqual([
            `.gitignore`,
            expect.stringContaining(`no-deps-npm-1.0.0-`),
          ]);
        }
      )
    );
  });
});

async function setupProject(path) {
  await xfs.writeFilePromise(ppath.join(path, `.yarnrc.yml`), `plugins:\n  - ${JSON.stringify(require.resolve(`@yarnpkg/monorepo/scripts/plugin-workspace-tools.js`))}\n`);

  const pkg = async (name, dependencies, devDependencies) => {
    await xfs.mkdirpPromise(ppath.join(path, `packages/${name}`));
    await xfs.writeJsonPromise(ppath.join(path, `packages/${name}/package.json`), {name, dependencies, devDependencies});
  };

  await pkg(`foo`, {[`no-deps`]: `1.0.0`});
  await pkg(`bar`, {[`no-deps`]: `2.0.0`});
  await pkg(`baz`, {[`bar`]: `workspace:*`});
  await pkg(`qux`, {[`no-deps`]: `1.0.0`}, {[`no-deps-bins`]: `1.0.0`});
}
