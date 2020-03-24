import {npath} from '@yarnpkg/fslib';
import {fs}    from 'pkg-tests-core';

const {writeFile, writeJson} = fs;

describe('Node_Modules', () => {
  it('should install one dependency',
    makeTemporaryEnv(
      {
        dependencies: {
          [`resolve`]: `1.9.0`,
        },
      },
      async ({path, run, source}) => {
        await writeFile(npath.toPortablePath(`${path}/.yarnrc.yml`), `nodeLinker: "node-modules"\n`);

        await run(`install`);

        await expect(source(`require('resolve').sync('resolve')`)).resolves.toEqual(
          await source(`require.resolve('resolve')`),
        );
      },
    )
  );

  test(
    `workspace packages shouldn't be hoisted if they conflict with root dependencies`,
    makeTemporaryEnv(
      {
        private: true,
        workspaces: [`packages/*`],
        dependencies: {
          [`no-deps`]: `*`,
        },
      },
      async ({path, run, source}) => {
        await writeFile(npath.toPortablePath(`${path}/.yarnrc.yml`), `
          enableTransparentWorkspaces: false
          nodeLinker: "node-modules"
        `);

        await writeFile(
          npath.toPortablePath(`${path}/index.js`),
          `
            module.exports = require('no-deps/package.json');
          `,
        );

        await writeJson(npath.toPortablePath(`${path}/packages/workspace/package.json`), {
          name: `workspace`,
          version: `1.0.0`,
          dependencies: {
            [`no-deps`]: `workspace:*`,
          },
        });

        await writeJson(npath.toPortablePath(`${path}/packages/no-deps/package.json`), {
          name: `no-deps`,
          version: `1.0.0-local`,
        });

        await run(`install`);

        await expect(source(`require('.')`)).resolves.toMatchObject({
          name: `no-deps`,
          version: `2.0.0`,
        });
      },
    ),
  );

  test(
    `should support 'yarn run' from within build scripts`,
    makeTemporaryEnv(
      {
        dependencies: {
          pkg: `file:./pkg`,
        },
      },
      async ({path, run, source}) => {
        await writeFile(npath.toPortablePath(`${path}/.yarnrc.yml`), `
          nodeLinker: "node-modules"
        `);

        await writeJson(npath.toPortablePath(`${path}/pkg/package.json`), {
          name: `pkg`,
          scripts: {
            postinstall: `yarn run foo`,
            foo: `pwd`,
          },
        });

        await expect(run(`install`)).resolves.toBeTruthy();
      },
    ),
  );
});
