import {PortablePath} from '@yarnpkg/fslib';
import {fs, tests}    from 'pkg-tests-core';

const {readFile, writeFile, writeJson} = fs;

const getWorkspaces = async (run: tests.Run) => {
  const {stdout} = await run(`workspaces`, `list`, `--json`);
  const workspaces: Array<string> = stdout
    .trim()
    .split(`\n`)
    .map(line => JSON.parse(line))
    .map(({location}) => location);

  return workspaces;
};

describe(`Workspaces tests`, () => {
  test(
    `it should support basic glob patterns`,
    makeTemporaryMonorepoEnv({
      workspaces: [
        `packages/*`,
      ],
    }, {
      [`packages/foo`]: {},
      [`packages/bar`]: {},
      [`packages/baz`]: {},
    }, async ({path, run, source}) => {
      await expect(getWorkspaces(run)).resolves.toStrictEqual([
        `.`,
        `packages/bar`,
        `packages/baz`,
        `packages/foo`,
      ]);
    }),
  );

  test(
    `it should support negated glob patterns`,
    makeTemporaryMonorepoEnv({
      workspaces: [
        `packages/*`,
        `!packages/foo`,
      ],
    }, {
      [`packages/foo`]: {},
      [`packages/bar`]: {},
      [`packages/baz`]: {},
    }, async ({path, run, source}) => {
      await expect(getWorkspaces(run)).resolves.toStrictEqual([
        `.`,
        `packages/bar`,
        `packages/baz`,
      ]);
    }),
  );

  test(
    `it should not implicitely make workspaces require-able`,
    makeTemporaryEnv(
      {
        private: true,
        workspaces: [`packages/*`],
      },
      async ({path, run, source}) => {
        await writeJson(`${path}/packages/workspace-a/package.json` as PortablePath, {
          name: `workspace-a`,
          version: `1.0.0`,
        });

        await writeFile(
          `${path}/packages/workspace-a/index.js` as PortablePath,
          `
            module.exports = 42;
          `,
        );

        await run(`install`);

        await expect(source(`require('workspace-a')`)).rejects.toBeTruthy();
      },
    ),
  );

  test(
    `it should allow workspaces to require each others`,
    makeTemporaryEnv(
      {
        private: true,
        workspaces: [`packages/*`],
        dependencies: {
          [`workspace-a`]: `1.0.0`,
          [`workspace-b`]: `1.0.0`,
        },
      },
      async ({path, run, source}) => {
        await writeJson(`${path}/packages/workspace-a/package.json` as PortablePath, {
          name: `workspace-a`,
          version: `1.0.0`,
          dependencies: {
            [`workspace-b`]: `1.0.0`,
          },
        });

        await writeFile(
          `${path}/packages/workspace-a/index.js` as PortablePath,
          `
            module.exports = require('workspace-b/package.json');
          `,
        );

        await writeJson(`${path}/packages/workspace-b/package.json` as PortablePath, {
          name: `workspace-b`,
          version: `1.0.0`,
          dependencies: {
            [`workspace-a`]: `1.0.0`,
          },
        });

        await writeFile(
          `${path}/packages/workspace-b/index.js` as PortablePath,
          `
            module.exports = require('workspace-a/package.json');
          `,
        );

        await run(`install`);

        await expect(source(`require('workspace-a')`)).resolves.toMatchObject({
          name: `workspace-b`,
        });

        await expect(source(`require('workspace-b')`)).resolves.toMatchObject({
          name: `workspace-a`,
        });
      },
    ),
  );

  test(
    `it should resolve workspaces as regular packages if the versions don't match`,
    makeTemporaryEnv(
      {
        private: true,
        workspaces: [`packages/*`],
        dependencies: {
          [`workspace`]: `1.0.0`,
        },
      },
      async ({path, run, source}) => {
        await writeJson(`${path}/packages/workspace/package.json` as PortablePath, {
          name: `workspace`,
          version: `1.0.0`,
          dependencies: {
            [`no-deps`]: `2.0.0`,
          },
        });

        await writeFile(
          `${path}/packages/workspace/index.js` as PortablePath,
          `
            module.exports = require('no-deps/package.json');
          `,
        );

        await writeJson(`${path}/packages/no-deps/package.json` as PortablePath, {
          name: `no-deps`,
          version: `1.0.0`,
        });

        await run(`install`);

        await expect(source(`require('workspace')`)).resolves.toMatchObject({
          name: `no-deps`,
          version: `2.0.0`,
        });
      },
    ),
  );

  test(
    `it should resolve workspaces as regular packages if enableTransparentWorkspaces is disabled`,
    makeTemporaryEnv(
      {
        private: true,
        workspaces: [`packages/*`],
        dependencies: {
          [`workspace`]: `workspace:1.0.0`,
        },
      },
      async ({path, run, source}) => {
        await writeFile(`${path}/.yarnrc.yml` as PortablePath, `enableTransparentWorkspaces: false\n`);

        await writeJson(`${path}/packages/workspace/package.json` as PortablePath, {
          name: `workspace`,
          version: `1.0.0`,
          dependencies: {
            [`no-deps`]: `*`,
          },
        });

        await writeFile(
          `${path}/packages/workspace/index.js` as PortablePath,
          `
            module.exports = require('no-deps/package.json');
          `,
        );

        await writeJson(`${path}/packages/no-deps/package.json` as PortablePath, {
          name: `no-deps`,
          version: `1.0.0-local`,
        });

        await run(`install`);

        await expect(source(`require('workspace')`)).resolves.toMatchObject({
          name: `no-deps`,
          version: `2.0.0`,
        });
      },
    ),
  );

  test(
    `it should allow scripts defined in workspaces to run successfully`,
    makeTemporaryEnv(
      {
        private: true,
        workspaces: [`packages/*`],
      },
      async ({path, run, source}) => {
        await writeJson(`${path}/packages/workspace/package.json` as PortablePath, {
          name: `workspace`,
          version: `1.0.0`,
          dependencies: {
            [`has-bin-entries`]: `1.0.0`,
          },
        });

        await run(`install`);

        await expect(
          run(`run`, `has-bin-entries`, `foo`, {
            cwd: `${path}/packages/workspace` as PortablePath,
          }),
        ).resolves.toMatchObject({stdout: `foo\n`});
      },
    ),
  );

  test(
    `it should run the postinstall script when running an install`,
    makeTemporaryEnv(
      {
        private: true,
        workspaces: [`packages/*`],
      },
      async ({path, run, source}) => {
        await writeJson(`${path}/packages/workspace/package.json` as PortablePath, {
          name: `workspace`,
          version: `1.0.0`,
          scripts: {
            [`preinstall`]: `node ./write.js ./workspace.dat "Preinstall"`,
            [`install`]: `node ./write.js ./workspace.dat "Install"`,
            [`postinstall`]: `node ./write.js ./workspace.dat "Postinstall"`,
          },
        });

        await writeFile(`${path}/packages/workspace/write.js` as PortablePath, `
          require('fs').appendFileSync(process.argv[2], process.argv[3] + '\\n');
        `);

        await run(`install`);

        await expect(readFile(`${path}/packages/workspace/workspace.dat` as PortablePath, `utf8`)).resolves.toEqual([
          `Preinstall\n`,
          `Install\n`,
          `Postinstall\n`,
        ].join(``));
      },
    ),
  );
});
