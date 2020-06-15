const {
  fs: {writeJson},
  misc: {parseJsonStream},
} = require(`pkg-tests-core`);

describe(`Commands`, () => {
  describe(`workspace list -v,--verbose --json`, () => {
    test(
      `no workspace dependency between a and b`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`packages/*`],
        },
        async ({path, run}) => {
          await writeJson(`${path}/packages/workspace-a/package.json`, {
            name: `workspace-a`,
            version: `1.0.0`,
          });

          await writeJson(`${path}/packages/workspace-b/package.json`, {
            name: `workspace-b`,
            version: `1.0.0`,
          });

          await expect(parseJsonStream(
            (await run(`workspaces`, `list`, `-v`, `--json`)).stdout,
            `location`,
          )).toEqual({
            [`.`]: {
              location: `.`,
              name: null,
              workspaceDependencies: [],
              mismatchedWorkspaceDependencies:[],
            },
            [`packages/workspace-a`]: {
              location: `packages/workspace-a`,
              name: `workspace-a`,
              workspaceDependencies: [],
              mismatchedWorkspaceDependencies: [],
            },
            [`packages/workspace-b`]: {
              location: `packages/workspace-b`,
              name: `workspace-b`,
              workspaceDependencies: [],
              mismatchedWorkspaceDependencies: [],
            },
          });
        }
      )
    );

    test(
      `workspace-a requires workspace-b, workspace-b requires workspace-a`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`packages/*`],
        },
        async ({path, run}) => {
          await writeJson(`${path}/packages/workspace-a/package.json`, {
            name: `workspace-a`,
            version: `1.0.0`,
            dependencies: {
              [`workspace-b`]: `1.0.0`,
            },
          });

          await writeJson(`${path}/packages/workspace-b/package.json`, {
            name: `workspace-b`,
            version: `1.0.0`,
            dependencies: {
              [`workspace-a`]: `1.0.0`,
            },
          });

          await expect(parseJsonStream(
            (await run(`workspaces`, `list`, `-v`, `--json`)).stdout,
            `location`,
          )).toEqual({
            [`.`]: {
              location: `.`,
              name: null,
              workspaceDependencies: [],
              mismatchedWorkspaceDependencies:[],
            },
            [`packages/workspace-a`]: {
              location: `packages/workspace-a`,
              name: `workspace-a`,
              workspaceDependencies: [`packages/workspace-b`],
              mismatchedWorkspaceDependencies: [],
            },
            [`packages/workspace-b`]: {
              location: `packages/workspace-b`,
              name: `workspace-b`,
              workspaceDependencies: [`packages/workspace-a`],
              mismatchedWorkspaceDependencies: [],
            },
          });
        }
      )
    );

    test(
      `workspace-a requires mismatched version of workspace-b`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`packages/*`],
        },
        async ({path, run}) => {
          await writeJson(`${path}/packages/workspace-a/package.json`, {
            name: `workspace-a`,
            version: `1.0.0`,
            dependencies: {
              [`workspace-b`]: `2.0.0`,
            },
          });

          await writeJson(`${path}/packages/workspace-b/package.json`, {
            name: `workspace-b`,
            version: `1.0.0`,
          });

          await expect(parseJsonStream(
            (await run(`workspaces`, `list`, `-v`, `--json`)).stdout,
            `location`,
          )).toEqual({
            [`.`]: {
              location: `.`,
              name: null,
              workspaceDependencies: [],
              mismatchedWorkspaceDependencies:[],
            },
            [`packages/workspace-a`]: {
              location: `packages/workspace-a`,
              name: `workspace-a`,
              workspaceDependencies: [],
              mismatchedWorkspaceDependencies: [`workspace-b@2.0.0`],
            },
            [`packages/workspace-b`]: {
              location: `packages/workspace-b`,
              name: `workspace-b`,
              workspaceDependencies: [],
              mismatchedWorkspaceDependencies: [],
            },
          });
        }
      )
    );
  });
});
