import {Filename, npath, xfs} from '@yarnpkg/fslib';

const {
  fs: {writeJson},
} = require(`pkg-tests-core`);

describe(`Commands`, () => {
  describe(`link`, () => {
    test(
      `it should allow to link a project with another one`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const tmp = await xfs.mktempPromise();

        await writeJson(`${tmp}/my-package/package.json`, {
          name: `my-package`,
        });

        await run(`link`, `${tmp}/my-package`);

        await expect(xfs.readJsonPromise(`${path}/package.json`)).resolves.toMatchObject({
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
          const tmp = await xfs.mktempPromise();

          await writeJson(`${tmp}/my-package/package.json`, {
            name: `my-package`,
          });

          await writeJson(`${path}/packages/workspace/package.json`, {
            name: `workspace`,
          });

          await run(`link`, `${tmp}/my-package`, {
            cwd: `${path}/packages/workspace`,
          });

          await expect(xfs.readJsonPromise(`${path}/package.json`)).resolves.toMatchObject({
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
        const tmp = await xfs.mktempPromise();

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

        await expect(xfs.readJsonPromise(`${path}/package.json`)).resolves.toMatchObject({
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
        const tmp = await xfs.mktempPromise();

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

        await expect(xfs.readJsonPromise(`${path}/package.json`)).resolves.toMatchObject({
          resolutions: {
            [`workspace-a`]: `portal:${npath.toPortablePath(`${tmp}/my-workspace/packages/workspace-a`)}`,
          },
        });

        await expect(xfs.readJsonPromise(`${path}/package.json`)).resolves.not.toMatchObject({
          resolutions: {
            [`workspace-b`]: expect.anything(),
          },
        });
      }),
    );

    test(
      `it should link the private workspaces if the right flag is used`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const tmp = await xfs.mktempPromise();

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

        await expect(xfs.readJsonPromise(`${path}/package.json`)).resolves.toMatchObject({
          resolutions: {
            [`workspace-a`]: `portal:${npath.toPortablePath(`${tmp}/my-workspace/packages/workspace-a`)}`,
            [`workspace-b`]: `portal:${npath.toPortablePath(`${tmp}/my-workspace/packages/workspace-b`)}`,
          },
        });
      }),
    );

    test(
      `it should not load the link target config in strict mode`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await xfs.mktempPromise(async target => {
          await Promise.all([
            xfs.writeJsonPromise(`${target}/package.json`, {name: `portal-target`}),
            xfs.writeFilePromise(`${target}/${Filename.rc}`, `unknownConfig: 42`),
          ]);

          await expect(run(`link`, target)).resolves.toMatchObject({code: 0});

          await expect(xfs.readJsonPromise(`${path}/package.json`)).resolves.toMatchObject({
            resolutions: {
              [`portal-target`]: `portal:${npath.toPortablePath(target)}`,
            },
          });
        });
      }),
    );

    test(
      `it should not load plugins from the link target`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await xfs.mktempPromise(async target => {
          await Promise.all([
            xfs.writeJsonPromise(`${target}/package.json`, {name: `portal-target`}),
            xfs.writeFilePromise(`${target}/${Filename.rc}`, `plugins:\n  - path: ./foo.js`),
            xfs.writeFilePromise(`${target}/foo.js`, `throw new Error(42)`),
          ]);

          await expect(run(`link`, target)).resolves.toMatchObject({code: 0});

          await expect(xfs.readJsonPromise(`${path}/package.json`)).resolves.toMatchObject({
            resolutions: {
              [`portal-target`]: `portal:${npath.toPortablePath(target)}`,
            },
          });
        });
      }),
    );

    test(
      `it should not allow linking a project to itself`,
      makeTemporaryEnv(
        {
          name: `foo`,
        },
        async ({path, run, source}) => {
          await expect(run(`link`, path)).rejects.toMatchObject({
            code: 1,
            stdout: expect.stringContaining(`Can't link the project to itself`),
          });
        },
      ),
    );

    test(
      `it should allow linking multiple workspaces`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const tmp = await xfs.mktempPromise();

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

        await writeJson(`${tmp}/my-workspace/packages/workspace-c/package.json`, {
          name: `workspace-c`,
        });

        await run(`link`, `${tmp}/my-workspace/packages/workspace-b`, `${tmp}/my-workspace/packages/workspace-c`);

        const manifest = await xfs.readJsonPromise(`${path}/package.json`);

        expect(manifest.resolutions).not.toHaveProperty(`workspace-a`);
        await expect(manifest).toMatchObject({
          resolutions: {
            [`workspace-b`]: `portal:${npath.toPortablePath(`${tmp}/my-workspace/packages/workspace-b`)}`,
            [`workspace-c`]: `portal:${npath.toPortablePath(`${tmp}/my-workspace/packages/workspace-c`)}`,
          },
        });
      }),
    );
  });
});
