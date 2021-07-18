import {npath} from '@yarnpkg/fslib';

const {
  fs: {createTemporaryFolder, readJson, writeJson},
} = require(`pkg-tests-core`);

describe(`Commands`, () => {
  describe(`unlink`, () => {
    test(
      `it should allow to unlink a project from another one`,
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

        await run(`unlink`, `${tmp}/my-package`);

        await expect(readJson(`${path}/package.json`)).resolves.toEqual({});
      }),
    );

    test(
      `it should remove the resolution override from the top-level workspace`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`packages/*`],
        },
        async ({path, run, source}) => {
          const tmp = await createTemporaryFolder();

          await writeJson(`${tmp}/my-package-a/package.json`, {
            name: `my-package-a`,
          });

          await writeJson(`${tmp}/my-package-b/package.json`, {
            name: `my-package-b`,
          });

          await writeJson(`${path}/packages/workspace/package.json`, {
            name: `workspace`,
          });

          await run(`link`, `${tmp}/my-package-a`, {
            cwd: `${path}/packages/workspace`,
          });

          await run(`link`, `${tmp}/my-package-b`, {
            cwd: `${path}/packages/workspace`,
          });

          await expect(readJson(`${path}/package.json`)).resolves.toEqual(expect.objectContaining({
            resolutions: {
              [`my-package-a`]: `portal:${npath.toPortablePath(`${tmp}/my-package-a`)}`,
              [`my-package-b`]: `portal:${npath.toPortablePath(`${tmp}/my-package-b`)}`,
            },
          }));

          await run(`unlink`, `${tmp}/my-package-b`, {
            cwd: `${path}/packages/workspace`,
          });

          await expect(readJson(`${path}/package.json`)).resolves.toEqual(expect.objectContaining({
            resolutions: {
              [`my-package-a`]: `portal:${npath.toPortablePath(`${tmp}/my-package-a`)}`,
            },
          }));
        },
      ),
    );

    test(
      `it should remove all resolutions with the portal protocol when no destination specified`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`packages/*`],
        },
        async ({path, run, source}) => {
          const tmp = await createTemporaryFolder();

          await writeJson(`${tmp}/my-package-a/package.json`, {
            name: `my-package-a`,
          });

          await writeJson(`${tmp}/my-package-b/package.json`, {
            name: `my-package-b`,
          });

          await writeJson(`${path}/packages/workspace/package.json`, {
            name: `workspace`,
          });

          await run(`link`, `${tmp}/my-package-a`, {
            cwd: `${path}/packages/workspace`,
          });

          await run(`link`, `${tmp}/my-package-b`, {
            cwd: `${path}/packages/workspace`,
          });

          await expect(readJson(`${path}/package.json`)).resolves.toEqual(expect.objectContaining({
            resolutions: {
              [`my-package-a`]: `portal:${npath.toPortablePath(`${tmp}/my-package-a`)}`,
              [`my-package-b`]: `portal:${npath.toPortablePath(`${tmp}/my-package-b`)}`,
            },
          }));

          await run(`unlink`, `--all`, {
            cwd: `${path}/packages/workspace`,
          });

          await expect(readJson(`${path}/package.json`)).resolves.not.toEqual(expect.objectContaining({
            resolutions: expect.objectContaining({
              [`my-package-a`]: `portal:${npath.toPortablePath(`${tmp}/my-package-a`)}`,
              [`my-package-b`]: `portal:${npath.toPortablePath(`${tmp}/my-package-b`)}`,
            }),
          }));
        },
      ),
    );

    test(
      `it should remove all resolutions matching the specified glob`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`packages/*`],
        },
        async ({path, run, source}) => {
          const tmp = await createTemporaryFolder();

          await writeJson(`${tmp}/my-package-a/package.json`, {
            name: `my-package-a`,
          });

          await writeJson(`${tmp}/my-package-b/package.json`, {
            name: `my-package-b`,
          });

          await writeJson(`${path}/packages/workspace/package.json`, {
            name: `workspace`,
          });

          await run(`link`, `${tmp}/my-package-a`, {
            cwd: `${path}/packages/workspace`,
          });

          await run(`link`, `${tmp}/my-package-b`, {
            cwd: `${path}/packages/workspace`,
          });

          await expect(readJson(`${path}/package.json`)).resolves.toEqual(expect.objectContaining({
            resolutions: {
              [`my-package-a`]: `portal:${npath.toPortablePath(`${tmp}/my-package-a`)}`,
              [`my-package-b`]: `portal:${npath.toPortablePath(`${tmp}/my-package-b`)}`,
            },
          }));

          await run(`unlink`, `my-*-b`, {
            cwd: `${path}/packages/workspace`,
          });

          await expect(readJson(`${path}/package.json`)).resolves.toEqual(expect.objectContaining({
            resolutions: {
              [`my-package-a`]: `portal:${npath.toPortablePath(`${tmp}/my-package-a`)}`,
            },
          }));
          await expect(readJson(`${path}/package.json`)).resolves.not.toEqual(expect.objectContaining({
            resolutions: {
              [`my-package-b`]: `portal:${npath.toPortablePath(`${tmp}/my-package-b`)}`,
            },
          }));
        },
      ),
    );

    test(
      `it should allow to unlink all workspaces specified from another project`,
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

        await writeJson(`${tmp}/my-package/package.json`, {
          name: `my-package`,
        });

        await run(`link`, `${tmp}/my-workspace`, `--all`);
        await run(`link`, `${tmp}/my-package`);

        await expect(readJson(`${path}/package.json`)).resolves.toEqual(expect.objectContaining({
          resolutions: {
            [`my-package`]: `portal:${npath.toPortablePath(`${tmp}/my-package`)}`,
            [`workspace-a`]: `portal:${npath.toPortablePath(`${tmp}/my-workspace/packages/workspace-a`)}`,
            [`workspace-b`]: `portal:${npath.toPortablePath(`${tmp}/my-workspace/packages/workspace-b`)}`,
          },
        }));

        await run(`unlink`, `${tmp}/my-workspace`, `--all`);

        await expect(readJson(`${path}/package.json`)).resolves.toEqual(expect.objectContaining({
          resolutions: {
            [`my-package`]: `portal:${npath.toPortablePath(`${tmp}/my-package`)}`,
          },
        }));
      }),
    );

    test(
      `it should remove resolutions matching the multiple globs and paths provided`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`packages/*`],
        },
        async ({path, run, source}) => {
          const tmp = await createTemporaryFolder();

          await writeJson(`${path}/packages/workspace/package.json`, {
            name: `workspace`,
          });

          const packages = [`my-package-a`, `my-package-b`, `my-package-c`, `my-package-d`];
          for (const pkg of packages) {
            await writeJson(`${tmp}/${pkg}/package.json`, {
              name: pkg,
            });
            await run(`link`, `${tmp}/${pkg}`, {
              cwd: `${path}/packages/workspace`,
            });
          }

          await expect(readJson(`${path}/package.json`)).resolves.toEqual(expect.objectContaining({
            resolutions: {
              [`my-package-a`]: `portal:${npath.toPortablePath(`${tmp}/my-package-a`)}`,
              [`my-package-b`]: `portal:${npath.toPortablePath(`${tmp}/my-package-b`)}`,
              [`my-package-c`]: `portal:${npath.toPortablePath(`${tmp}/my-package-c`)}`,
              [`my-package-d`]: `portal:${npath.toPortablePath(`${tmp}/my-package-d`)}`,
            },
          }));

          await run(`unlink`, `my-package-{a,b}`, `${tmp}/my-package-d`, {
            cwd: `${path}/packages/workspace`,
          });

          await expect(readJson(`${path}/package.json`)).resolves.toEqual(expect.objectContaining({
            resolutions: {
              [`my-package-c`]: `portal:${npath.toPortablePath(`${tmp}/my-package-c`)}`,
            },
          }));
          await expect(readJson(`${path}/package.json`)).resolves.not.toEqual(expect.objectContaining({
            resolutions: {
              [`my-package-a`]: `portal:${npath.toPortablePath(`${tmp}/my-package-a`)}`,
              [`my-package-b`]: `portal:${npath.toPortablePath(`${tmp}/my-package-b`)}`,
              [`my-package-d`]: `portal:${npath.toPortablePath(`${tmp}/my-package-d`)}`,
            },
          }));
        },
      ),
    );
  });
});
