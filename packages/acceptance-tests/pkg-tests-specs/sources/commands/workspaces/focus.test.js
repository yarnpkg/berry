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
  });
});

async function setupProject(path) {
  await xfs.writeFilePromise(ppath.join(path, `.yarnrc.yml`), `plugins:\n  - ${JSON.stringify(require.resolve(`@yarnpkg/monorepo/scripts/plugin-workspace-tools.js`))}\n`);

  const pkg = async (name, dependencies) => {
    await xfs.mkdirpPromise(ppath.join(path, `packages/${name}`));
    await xfs.writeJsonPromise(ppath.join(path, `packages/${name}/package.json`), {name, dependencies});
  };

  await pkg(`foo`, {[`no-deps`]: `1.0.0`});
  await pkg(`bar`, {[`no-deps`]: `2.0.0`});
  await pkg(`baz`, {[`bar`]: `workspace:*`});
}
