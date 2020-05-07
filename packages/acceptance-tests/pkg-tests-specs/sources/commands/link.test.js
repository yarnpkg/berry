import {npath} from '@yarnpkg/fslib';

const {
  fs: {createTemporaryFolder, readJson, writeJson},
} = require(`pkg-tests-core`);

describe(`Commands`, () => {
  describe(`link`, () => {
    test(
      `it should allow to link a project with another one`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const tmp = await createTemporaryFolder();

        await writeJson(`${tmp}/my-package/package.json`, {
          name: `my-package`,
        });

        await run(`link`, `${tmp}/my-package`);

        await expect(readJson(`${path}/package.json`)).resolves.toMatchObject({
          resolutions: {
            [`my-package`]: `portal:${npath.toPortablePath(`${tmp}/my-package`)}`,
          },
        });
      }),
    );

    test(
      `it should add the resolution override to the top-level workspace`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`packages/*`],
        },
        async ({path, run, source}) => {
          const tmp = await createTemporaryFolder();

          await writeJson(`${tmp}/my-package/package.json`, {
            name: `my-package`,
          });

          await writeJson(`${path}/packages/workspace/package.json`, {
            name: `workspace`,
          });

          await run(`link`, `${tmp}/my-package`, {
            cwd: `${path}/packages/workspace`,
          });

          await expect(readJson(`${path}/package.json`)).resolves.toMatchObject({
            resolutions: {
              [`my-package`]: `portal:${npath.toPortablePath(`${tmp}/my-package`)}`,
            },
          });
        },
      ),
    );

    test(
      `it should allow to link all workspaces from another project`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const tmp = await createTemporaryFolder();

        await writeJson(`${tmp}/my-workspace/package.json`, {
          private: true,
          workspaces: [`packages/*`],
        });

        await writeJson(`${tmp}/my-workspace/packages/workspace-a/package.json`, {
          name: `workspace-a`,
        });

        await writeJson(`${tmp}/my-workspace/packages/workspace-b/package.json`, {
          name: `workspace-b`,
        });

        await run(`link`, `${tmp}/my-workspace`, `--all`);

        await expect(readJson(`${path}/package.json`)).resolves.toMatchObject({
          resolutions: {
            [`workspace-a`]: `portal:${npath.toPortablePath(`${tmp}/my-workspace/packages/workspace-a`)}`,
            [`workspace-b`]: `portal:${npath.toPortablePath(`${tmp}/my-workspace/packages/workspace-b`)}`,
          },
        });
      }),
    );

    test(
      `it should not link the private workspaces by default`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const tmp = await createTemporaryFolder();

        await writeJson(`${tmp}/my-workspace/package.json`, {
          private: true,
          workspaces: [`packages/*`],
        });

        await writeJson(`${tmp}/my-workspace/packages/workspace-a/package.json`, {
          name: `workspace-a`,
        });

        await writeJson(`${tmp}/my-workspace/packages/workspace-b/package.json`, {
          name: `workspace-b`,
          private: true,
        });

        await run(`link`, `${tmp}/my-workspace`, `--all`);

        await expect(readJson(`${path}/package.json`)).resolves.toMatchObject({
          resolutions: {
            [`workspace-a`]: `portal:${npath.toPortablePath(`${tmp}/my-workspace/packages/workspace-a`)}`,
          },
        });

        await expect(readJson(`${path}/package.json`)).resolves.not.toMatchObject({
          resolutions: {
            [`workspace-b`]: expect.anything(),
          },
        });
      }),
    );

    test(
      `it should link the private workspaces if the right flag is used`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const tmp = await createTemporaryFolder();

        await writeJson(`${tmp}/my-workspace/package.json`, {
          private: true,
          workspaces: [`packages/*`],
        });

        await writeJson(`${tmp}/my-workspace/packages/workspace-a/package.json`, {
          name: `workspace-a`,
        });

        await writeJson(`${tmp}/my-workspace/packages/workspace-b/package.json`, {
          name: `workspace-b`,
          private: true,
        });

        await run(`link`, `${tmp}/my-workspace`, `--all`, `--private`);

        await expect(readJson(`${path}/package.json`)).resolves.toMatchObject({
          resolutions: {
            [`workspace-a`]: `portal:${npath.toPortablePath(`${tmp}/my-workspace/packages/workspace-a`)}`,
            [`workspace-b`]: `portal:${npath.toPortablePath(`${tmp}/my-workspace/packages/workspace-b`)}`,
          },
        });
      }),
    );
  });
});
