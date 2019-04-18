const {
  fs: {writeFile, writeJson},
} = require('pkg-tests-core');

describe(`Commands`, () => {
  describe(`workspace list -v,--verbose --json`, () => {
    test(
      `no workspace dependency between a and b`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`packages/*`]
        },
        async ({path, run}) => {
          await writeJson(`${path}/packages/workspace-a/package.json`, {
            name: `workspace-a`,
            version: `1.0.0`
          });
  
          await writeFile(
            `${path}/packages/workspace-a/index.js`,
            `
              module.exports = 42;
            `,
          );
  
          await writeJson(`${path}/packages/workspace-b/package.json`, {
            name: `workspace-b`,
            version: `1.0.0`
          });
  
          await writeFile(
            `${path}/packages/workspace-b/index.js`,
            `
              module.exports = 24;
            `,
          );
          
          await expect(run(`workspaces`, `list`, `-v`, `--json`)).resolves.toMatchObject({
            stdout: `{"location":"packages/workspace-a","name":"workspace-a","workspaceDependencies":[],"mismatchedWorkspaceDependencies":[]}\n{"location":"packages/workspace-b","name":"workspace-b","workspaceDependencies":[],"mismatchedWorkspaceDependencies":[]}\n`,
          });
        }
      )
    );

    test(
      `workspace-a requires workspace-b, workspace-b requires workspace-a`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`packages/*`]
        },
        async ({path, run}) => {
          await writeJson(`${path}/packages/workspace-a/package.json`, {
            name: `workspace-a`,
            version: `1.0.0`,
            dependencies: {
              [`workspace-b`]: `1.0.0`,
            },
          });
  
          await writeFile(
            `${path}/packages/workspace-a/index.js`,
            `
              module.exports = require('workspace-b/package.json');
            `,
          );
  
          await writeJson(`${path}/packages/workspace-b/package.json`, {
            name: `workspace-b`,
            version: `1.0.0`,
            dependencies: {
              [`workspace-a`]: `1.0.0`,
            },
          });
  
          await writeFile(
            `${path}/packages/workspace-b/index.js`,
            `
              module.exports = require('workspace-a/package.json');
            `,
          );
          
          await expect(run(`workspaces`, `list`, `--verbose`, `--json`)).resolves.toMatchObject({
            stdout: `{"location":"packages/workspace-a","name":"workspace-a","workspaceDependencies":["packages/workspace-b"],"mismatchedWorkspaceDependencies":[]}\n{"location":"packages/workspace-b","name":"workspace-b","workspaceDependencies":["packages/workspace-a"],"mismatchedWorkspaceDependencies":[]}\n`,
          });
        }
      )
    );

    test(
      `workspace-a requires mismatched version of workspace-b`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`packages/*`]
        },
        async ({path, run}) => {
          await writeJson(`${path}/packages/workspace-a/package.json`, {
            name: `workspace-a`,
            version: `1.0.0`,
            dependencies: {
              [`workspace-b`]: `2.0.0`,
            },
          });
  
          await writeFile(
            `${path}/packages/workspace-a/index.js`,
            `
              module.exports = require('workspace-b/package.json');
            `,
          );
  
          await writeJson(`${path}/packages/workspace-b/package.json`, {
            name: `workspace-b`,
            version: `1.0.0`
          });
  
          await writeFile(
            `${path}/packages/workspace-b/index.js`,
            `
              module.exports = 53;
            `,
          );
          
          await expect(run(`workspaces`, `list`, `-v`, `--json`)).resolves.toMatchObject({
            stdout: `{"location":"packages/workspace-a","name":"workspace-a","workspaceDependencies":[],"mismatchedWorkspaceDependencies":["workspace-b@2.0.0"]}\n{"location":"packages/workspace-b","name":"workspace-b","workspaceDependencies":[],"mismatchedWorkspaceDependencies":[]}\n`,
          });
        }
      )
    );
  });
});
