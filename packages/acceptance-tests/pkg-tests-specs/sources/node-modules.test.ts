import {xfs, npath, PortablePath} from '@yarnpkg/fslib';

const {
  fs: {writeFile, writeJson},
  tests: {testIf},
} = require(`pkg-tests-core`);

describe(`Node_Modules`, () => {
  it(`should install one dependency`,
    makeTemporaryEnv(
      {
        dependencies: {
          [`resolve`]: `1.9.0`,
        },
      },
      {
        nodeLinker: `node-modules`,
      },
      async ({path, run, source}) => {
        await run(`install`);

        await expect(source(`require('resolve').sync('resolve')`)).resolves.toEqual(
          await source(`require.resolve('resolve')`),
        );
      },
    )
  );

  testIf(
    () => process.platform !== `win32`,
    `should setup the right symlinks`,
    makeTemporaryEnv(
      {
        dependencies: {
          [`has-symlinks`]: `1.0.0`,
        },
      },
      {
        nodeLinker: `node-modules`,
      },
      async ({path, run, source}) => {
        await run(`install`);

        await expect(source(`require('has-symlinks/symlink')`)).resolves.toMatchObject({
          name: `has-symlinks`,
          version: `1.0.0`,
        });
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
      {
        enableTransparentWorkspaces: false,
        nodeLinker: `node-modules`,
      },
      async ({path, run, source}) => {
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
      {
        nodeLinker: `node-modules`,
      },
      async ({path, run, source}) => {
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

  test(`should not fail if target bin link does not exist`,
    makeTemporaryEnv(
      {
        name: `pkg`,
        bin: `dist/bin/index.js`,
      },
      {
        nodeLinker: `node-modules`,
      },
      async ({path, run, source}) => {
        await expect(run(`install`)).resolves.toBeTruthy();
        await expect(xfs.lstatPromise(npath.toPortablePath(`${path}/node_modules/.bin/pkg`))).rejects.toThrow();

        await writeFile(npath.toPortablePath(`${path}/dist/bin/index.js`), ``);

        await expect(run(`install`)).resolves.toBeTruthy();
        const stats = await xfs.lstatPromise(npath.toPortablePath(`${path}/node_modules/.bin/pkg`));

        expect(stats).toBeDefined();

        if (process.platform !== `win32`) {
          // Check that destination has 0o700 - execute for all permissions set
          expect(stats.mode & 0o700).toEqual(0o700);
        }
      },
    ),
  );

  test(`should support dependency via link: protocol to a missing folder`,
    makeTemporaryEnv(
      {
        dependencies: {
          abc: `link:../abc`,
        },
      },
      {
        nodeLinker: `node-modules`,
      },
      async ({path, run, source}) => {
        await writeFile(npath.toPortablePath(`${path}/../one-fixed-dep.local/abc.js`), ``);

        await expect(run(`install`)).resolves.toBeTruthy();

        await expect(xfs.lstatPromise(npath.toPortablePath(`${path}/node_modules/abc`))).resolves.toBeDefined();
      },
    ),
  );

  test(`should support replacement of regular dependency with portal: protocol dependency`,
    makeTemporaryEnv(
      {
        private: true,
        dependencies: {
          [`one-fixed-dep`]: `*`,
        },
      },
      {
        nodeLinker: `node-modules`,
      },
      async ({path, run, source}) => {
        await writeJson(npath.toPortablePath(`${path}/../one-fixed-dep.local/package.json`), {
          name: `one-fixed-dep`,
          bin: `abc.js`,
          dependencies: {
            [`no-deps`]: `*`,
          },
        });
        await writeFile(npath.toPortablePath(`${path}/../one-fixed-dep.local/abc.js`), ``);

        await expect(run(`install`)).resolves.toBeTruthy();

        await writeJson(npath.toPortablePath(`${path}/package.json`), {
          private: true,
          dependencies: {
            [`one-fixed-dep`]: `portal:../one-fixed-dep.local`,
          },
        });

        await expect(run(`install`)).resolves.toBeTruthy();
        await expect(xfs.lstatPromise(npath.toPortablePath(`${path}/../one-fixed-dep.local/node_modules`))).rejects.toThrow();
        await expect(xfs.lstatPromise(npath.toPortablePath(`${path}/node_modules/.bin/one-fixed-dep`))).resolves.toBeDefined();
      },
    ),
  );

  test(`should return real cwd for scripts inside workspaces`,
    makeTemporaryEnv(
      {
        private: true,
        workspaces: [`packages/*`],
      },
      {
        nodeLinker: `node-modules`,
      },
      async ({path, run, source}) => {
        await writeJson(npath.toPortablePath(`${path}/packages/workspace/package.json`), {
          name: `workspace`,
          version: `1.0.0`,
          scripts: {
            [`ws:cwd`]: `node -p 'process.cwd()'`,
          },
        });

        await run(`install`);

        expect((await run(`run`, `ws:cwd`)).stdout.trim()).toEqual(npath.fromPortablePath(`${path}/packages/workspace`));
      },
    ),
  );

  test(`should not recreate folders when package is updated`,
    makeTemporaryEnv(
      {
        private: true,
        dependencies: {
          [`no-deps`]: `1.0.0`,
        },
      },
      {
        nodeLinker: `node-modules`,
      },
      async ({path, run}) => {
        await expect(run(`install`)).resolves.toBeTruthy();

        const nmFolderInode = xfs.statSync(npath.toPortablePath(`${path}/node_modules`)).ino;
        const depFolderInode = xfs.statSync(npath.toPortablePath(`${path}/node_modules/no-deps`)).ino;

        await writeJson(npath.toPortablePath(`${path}/package.json`), {
          private: true,
          dependencies: {
            [`no-deps`]: `2.0.0`,
          },
        });

        await expect(run(`install`)).resolves.toBeTruthy();

        expect(xfs.statSync(npath.toPortablePath(`${path}/node_modules`)).ino).toEqual(nmFolderInode);
        expect(xfs.statSync(npath.toPortablePath(`${path}/node_modules/no-deps`)).ino).toEqual(depFolderInode);
      },
    ),
  );

  test(`should skip linking incompatible package`,
    makeTemporaryEnv(
      {
        private: true,
        dependencies: {
          dep: `file:./dep`,
        },
      },
      {
        nodeLinker: `node-modules`,
      },
      async ({path, run, source}) => {
        await writeJson(npath.toPortablePath(`${path}/dep/package.json`), {
          name: `dep`,
          version: `1.0.0`,
          os: [`!${process.platform}`],
          scripts: {
            postinstall: `echo 'Shall not be run'`,
          },
        });

        const stdout = (await run(`install`)).stdout;

        expect(stdout).not.toContain(`Shall not be run`);
        expect(stdout).toMatch(new RegExp(`dep@file:./dep.*The platform ${process.platform} is incompatible with this module, linking skipped.`));

        await expect(source(`require('dep')`)).rejects.toMatchObject({
          externalException: {
            code: `MODULE_NOT_FOUND`,
          },
        });
      },
    ),
  );

  test(`should support aliases`,
    makeTemporaryEnv(
      {
        private: true,
        workspaces: [`packages/*`],
        dependencies: {
          [`no-deps`]: `1.0.0`,
          [`no-deps2`]: `npm:no-deps@2.0.0`,
        },
      },
      {
        nodeLinker: `node-modules`,
      },
      async ({path, run, source}) => {
        await writeJson(npath.toPortablePath(`${path}/packages/workspace/package.json`), {
          name: `workspace`,
          version: `1.0.0`,
          dependencies: {
            [`no-deps`]: `npm:no-deps-bins@1.0.0`, // Should NOT be hoisted to the top
            [`no-deps2`]: `npm:no-deps@2.0.0`,     // Should be hoisted to the top
          },
        });
        await writeFile(`${path}/packages/workspace/index.js`,
          `module.exports = require('./package.json');\n` +
          `for (const key of ['dependencies', 'devDependencies', 'peerDependencies']) {\n` +
          `    for (const dep of Object.keys(module.exports[key] || {})) {\n` +
          `        module.exports[key][dep] = require(dep);\n` +
          `    }}\n`);

        await run(`install`);

        await expect(source(`require('no-deps')`)).resolves.toEqual({
          name: `no-deps`,
          version: `1.0.0`,
        });
        await expect(source(`require('no-deps2')`)).resolves.toEqual({
          name: `no-deps`,
          version: `2.0.0`,
        });
        await expect(source(`require('workspace').dependencies['no-deps2'] === require('no-deps2')`)).resolves.toEqual(true);
        await expect(source(`require('workspace').dependencies['no-deps']`)).resolves.toEqual({
          bin: `./bin`,
          name: `no-deps-bins`,
          version: `1.0.0`,
        });
      },
    ),
  );

  test(`should not hoist package peer dependent on parent if conflict exists`,
    // . -> dep -> conflict@2 -> unhoistable --> conflict
    //   -> conflict@1
    // `unhoistable` cannot be hoisted to the top, otherwise it will use wrong `conflict` version
    makeTemporaryEnv(
      {
        private: true,
        dependencies: {
          dep: `file:./dep`,
          conflict: `file:./conflict1`,
        },
      },
      {
        nodeLinker: `node-modules`,
      },
      async ({path, run, source}) => {
        await writeJson(npath.toPortablePath(`${path}/conflict1/package.json`), {
          name: `conflict`,
          version: `1.0.0`,
        });

        await writeJson(npath.toPortablePath(`${path}/conflict2/package.json`), {
          name: `conflict`,
          version: `2.0.0`,
          dependencies: {
            unhoistable: `file:../unhoistable`,
          },
        });

        await writeJson(npath.toPortablePath(`${path}/dep/package.json`), {
          name: `dep`,
          version: `1.0.0`,
          dependencies: {
            conflict: `file:../conflict2`,
          },
        });

        await writeJson(npath.toPortablePath(`${path}/unhoistable/package.json`), {
          name: `unhoistable`,
          version: `1.0.0`,
          peerDependencies: {
            conflict: `2.0.0`,
          },
        });
        await writeFile(`${path}/packages/unhoistable/index.js`,
          `module.exports = require('conflict/package.json').version`);

        await run(`install`);

        expect(await xfs.existsPromise(`${path}/node_modules/unhoistable` as PortablePath)).toBe(false);
      },
    ),
  );

  test(`should not produce orphaned symlinks on dependency removal having bin entries`,
    makeTemporaryEnv(
      {
        private: true,
        dependencies: {
          dep1: `file:./dep1`,
          dep2: `file:./dep2`,
        },
      },
      {
        nodeLinker: `node-modules`,
      },
      async ({path, run, source}) => {
        await writeJson(npath.toPortablePath(`${path}/dep1/package.json`), {
          name: `dep1`,
          version: `1.0.0`,
          bin: `bin1.js`,
        });
        await writeFile(`${path}/dep1/bin1.js`, ``);
        await writeJson(npath.toPortablePath(`${path}/dep2/package.json`), {
          name: `dep2`,
          version: `1.0.0`,
          bin: `bin2.js`,
        });
        await writeFile(`${path}/dep2/bin2.js`, ``);

        await run(`install`);

        const binPath = `${path}/node_modules/.bin/dep1` as PortablePath;
        expect(xfs.lstatPromise(binPath)).resolves.toBeDefined();
        await run(`remove`, `dep1`);
        expect(xfs.lstatPromise(binPath)).rejects.toBeDefined();
      },
    ),
  );
});
