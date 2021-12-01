const {
  exec: {execFile},
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
              mismatchedWorkspaceDependencies: [],
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
        },
      ),
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
              mismatchedWorkspaceDependencies: [],
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
        },
      ),
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
              mismatchedWorkspaceDependencies: [],
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
        },
      ),
    );

    test(
      `--since returns no workspaces if there have been no changes`,
      makeWorkspacesListSinceEnv(async ({run}) => {
        await expect(
          (await run(`workspaces`, `list`, `--since`, `-v`, `--json`)).stdout.trim(),
        ).toEqual(``);
      }),
    );

    test(
      `--since returns only changed workspaces`,
      makeWorkspacesListSinceEnv(async ({path, run}) => {
        await writeJson(`${path}/packages/workspace-a/delta.json`, {});

        await expect(parseJsonStream(
          (await run(`workspaces`, `list`, `--since`, `-v`, `--json`)).stdout,
          `location`,
        )).toEqual({
          [`packages/workspace-a`]: {
            location: `packages/workspace-a`,
            name: `workspace-a`,
            workspaceDependencies: [],
            mismatchedWorkspaceDependencies: [],
          },
        });
      }),
    );

    test(
      `--since returns no workspaces if there are no staged or unstaged changes on the default branch`,
      makeWorkspacesListSinceEnv(async ({git, path, run}) => {
        await writeJson(`${path}/packages/workspace-a/delta.json`, {});

        await git(`add`, `.`);
        await git(`commit`, `-m`, `wip`);

        await expect(
          (await run(`workspaces`, `list`, `--since`, `-v`, `--json`)).stdout.trim(),
        ).toEqual(``);
      }),
    );

    test(
      `--since returns workspaces changed since commit`,
      makeWorkspacesListSinceEnv(async ({git, path, run}) => {
        await writeJson(`${path}/packages/workspace-a/delta.json`, {});

        await git(`add`, `.`);
        await git(`commit`, `-m`, `wip`);

        const ref = (await git(`rev-parse`, `HEAD`)).stdout.trim();

        await writeJson(`${path}/packages/workspace-b/package.json`, {
          name: `workspace-b`,
          version: `1.0.0`,
        });
        await writeJson(`${path}/packages/workspace-c/package.json`, {
          name: `workspace-c`,
          version: `1.0.0`,
        });

        await expect(parseJsonStream(
          (await run(`workspaces`, `list`, `--since=${ref}`, `-v`, `--json`)).stdout,
          `location`,
        )).toEqual({
          [`packages/workspace-b`]: {
            location: `packages/workspace-b`,
            name: `workspace-b`,
            workspaceDependencies: [],
            mismatchedWorkspaceDependencies: [],
          },
          [`packages/workspace-c`]: {
            location: `packages/workspace-c`,
            name: `workspace-c`,
            workspaceDependencies: [],
            mismatchedWorkspaceDependencies: [],
          },
        });
      }),
    );

    test(
      `--since returns workspaces changed since branching from the default branch`,
      makeWorkspacesListSinceEnv(async ({git, path, run}) => {
        await writeJson(`${path}/packages/workspace-a/delta.json`, {});

        await git(`add`, `.`);
        await git(`commit`, `-m`, `wip`);
        await git(`checkout`, `-b`, `feature`);

        await writeJson(`${path}/packages/workspace-b/delta.json`, {});
        await writeJson(`${path}/packages/workspace-c/delta.json`, {});

        await expect(parseJsonStream(
          (await run(`workspaces`, `list`, `--since`, `-v`, `--json`)).stdout,
          `location`,
        )).toEqual({
          [`packages/workspace-b`]: {
            location: `packages/workspace-b`,
            name: `workspace-b`,
            workspaceDependencies: [
              `packages/workspace-a`,
              `packages/workspace-c`,
            ],
            mismatchedWorkspaceDependencies: [],
          },
          [`packages/workspace-c`]: {
            location: `packages/workspace-c`,
            name: `workspace-c`,
            workspaceDependencies: [
              `packages/workspace-a`,
            ],
            mismatchedWorkspaceDependencies: [],
          },
        });
      }),
    );

    test(
      `--since --recursive returns workspaces changed and their dependents`,
      makeWorkspacesListSinceEnv(async ({git, path, run}) => {
        await writeJson(`${path}/packages/workspace-a/delta.json`, {});

        await expect(parseJsonStream(
          (await run(`workspaces`, `list`, `--since`, `--recursive`, `-v`, `--json`)).stdout,
          `location`,
        )).toEqual({
          [`packages/workspace-a`]: {
            location: `packages/workspace-a`,
            name: `workspace-a`,
            workspaceDependencies: [],
            mismatchedWorkspaceDependencies: [],
          },
          [`packages/workspace-b`]: {
            location: `packages/workspace-b`,
            name: `workspace-b`,
            workspaceDependencies: [
              `packages/workspace-a`,
              `packages/workspace-c`,
            ],
            mismatchedWorkspaceDependencies: [],
          },
          [`packages/workspace-c/packages/workspace-d`]: {
            location: `packages/workspace-c/packages/workspace-d`,
            name: `workspace-d`,
            workspaceDependencies: [
              `packages/workspace-b`,
            ],
            mismatchedWorkspaceDependencies: [],
          },
          [`packages/workspace-c/packages/workspace-d/packages/workspace-e`]: {
            location: `packages/workspace-c/packages/workspace-d/packages/workspace-e`,
            name: `workspace-e`,
            workspaceDependencies: [
              `packages/workspace-c/packages/workspace-d`,
            ],
            mismatchedWorkspaceDependencies: [],
          },
          [`packages/workspace-c/packages/workspace-f`]: {
            location: `packages/workspace-c/packages/workspace-f`,
            name: `workspace-f`,
            workspaceDependencies: [
              `packages/workspace-c/packages/workspace-d/packages/workspace-e`,
            ],
            mismatchedWorkspaceDependencies: [],
          },
          [`packages/workspace-c`]: {
            location: `packages/workspace-c`,
            name: `workspace-c`,
            workspaceDependencies: [
              `packages/workspace-a`,
            ],
            mismatchedWorkspaceDependencies: [],
          },
        });
      }),
    );
  });
});

async function setupWorkspaces(path) {
  await writeJson(`${path}/packages/workspace-a/package.json`, {
    name: `workspace-a`,
    version: `1.0.0`,
  });

  await writeJson(`${path}/packages/workspace-b/package.json`, {
    name: `workspace-b`,
    version: `1.0.0`,
    dependencies: {
      [`workspace-a`]: `workspace:*`,
      [`workspace-c`]: `workspace:*`,
    },
  });

  await writeJson(`${path}/packages/workspace-c/package.json`, {
    name: `workspace-c`,
    version: `1.0.0`,
    workspaces: [`packages/*`],
    dependencies: {
      [`workspace-a`]: `workspace:*`,
    },
  });

  await writeJson(`${path}/packages/workspace-c/packages/workspace-d/package.json`, {
    name: `workspace-d`,
    version: `1.0.0`,
    workspaces: [`packages/*`],
    dependencies: {
      [`workspace-b`]: `workspace:*`,
    },
  });

  await writeJson(`${path}/packages/workspace-c/packages/workspace-d/packages/workspace-e/package.json`, {
    name: `workspace-e`,
    version: `1.0.0`,
    dependencies: {
      [`workspace-d`]: `workspace:*`,
    },
  });

  await writeJson(`${path}/packages/workspace-c/packages/workspace-f/package.json`, {
    name: `workspace-f`,
    version: `1.0.0`,
    dependencies: {
      [`workspace-e`]: `workspace:*`,
    },
  });

  await writeJson(`${path}/packages/workspace-c/packages/workspace-g/package.json`, {
    name: `workspace-g`,
    version: `1.0.0`,
  });
}

function makeWorkspacesListSinceEnv(cb) {
  return makeTemporaryEnv({
    private: true,
    workspaces: [`packages/*`],
  }, {}, async ({path, run, ...rest}) => {
    await setupWorkspaces(path);

    const git = (...args) => execFile(`git`, args, {cwd: path});

    await run(`install`);

    await git(`init`, `.`);

    // Otherwise we can't always commit
    await git(`config`, `user.name`, `John Doe`);
    await git(`config`, `user.email`, `john.doe@example.org`);
    await git(`config`, `commit.gpgSign`, `false`);

    await git(`add`, `.`);
    await git(`commit`, `-m`, `First commit`);

    await cb({path, run, ...rest, git});
  });
}
