import {xfs, npath, PortablePath, ppath, Filename} from '@yarnpkg/fslib';

const {
  fs: {readJson, writeFile, writeJson},
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
        expect(stdout).toMatch(new RegExp(`dep@file:./dep.*The platform ${process.platform} is incompatible with this module, link skipped.`));

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
        // We must not create self-reference directory 'node_modules/no-deps2/node_modules/no-deps'
        await expect(xfs.existsPromise(`${path}/node_modules/no-deps2/node_modules/no-deps` as PortablePath)).resolves.toEqual(false);
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

  test(`should respect transitive peer dependencies`,
    // . -> no-deps@1
    //   -> workspace -> peer-deps-lvl1 -> peer-deps-lvl2 --> no-deps
    //                                  --> no-deps
    //                -> no-deps@2
    // peer-deps-lvl2 inside workspace must not be hoisted to the top, otherwise it will use no-deps@1 instead of no-deps@2
    makeTemporaryEnv(
      {
        private: true,
        workspaces: [`workspace`],
        dependencies: {
          'no-deps': `1.0.0`,
        },
      },
      {
        nodeLinker: `node-modules`,
      },
      async ({path, run, source}) => {
        await writeJson(npath.toPortablePath(`${path}/workspace/package.json`), {
          name: `workspace`,
          version: `1.0.0`,
          dependencies: {
            'peer-deps-lvl1': `1.0.0`,
            'no-deps': `2.0.0`,
          },
        });

        await run(`install`);

        expect(await xfs.existsPromise(`${path}/workspace/node_modules/peer-deps-lvl1` as PortablePath)).toEqual(true);
        expect(await xfs.existsPromise(`${path}/workspace/node_modules/peer-deps-lvl2` as PortablePath)).toEqual(true);
      },
    )
  );


  test(`should not hoist a single package past workspace hoist border`,
    // . -> workspace -> dep
    // should be hoisted to:
    // . -> workspace -> dep
    makeTemporaryEnv(
      {
        private: true,
        workspaces: [`workspace`],
      },
      {
        nodeLinker: `node-modules`,
      },
      async ({path, run, source}) => {
        await writeJson(npath.toPortablePath(`${path}/workspace/package.json`), {
          name: `workspace`,
          version: `1.0.0`,
          dependencies: {
            dep: `file:./dep`,
          },
          installConfig: {
            hoistingLimits: `workspaces`,
          },
        });
        await writeJson(npath.toPortablePath(`${path}/workspace/dep/package.json`), {
          name: `dep`,
          version: `1.0.0`,
        });

        await run(`install`);

        expect(await xfs.existsPromise(`${path}/node_modules/dep` as PortablePath)).toEqual(false);
        expect(await xfs.existsPromise(`${path}/workspace/node_modules/dep` as PortablePath)).toEqual(true);
        // workspace symlink should NOT be hoisted to the top
        expect(await xfs.existsPromise(`${path}/node_modules/workspace` as PortablePath)).toEqual(false);
      },
    )
  );

  test(`should not hoist multiple packages past workspace hoist border`,
    // . -> workspace -> dep1 -> dep2
    // should be hoisted to:
    // . -> workspace -> dep1
    //                -> dep2
    makeTemporaryEnv(
      {
        private: true,
        workspaces: {
          packages: [`workspace`],
        },
      },
      {
        nodeLinker: `node-modules`,
        nmHoistingLimits: `workspaces`,
      },
      async ({path, run, source}) => {
        await writeJson(npath.toPortablePath(`${path}/workspace/package.json`), {
          name: `workspace`,
          version: `1.0.0`,
          dependencies: {
            dep1: `file:./dep1`,
            dep2: `file:./dep2`,
          },
        });
        await writeJson(npath.toPortablePath(`${path}/workspace/dep1/package.json`), {
          name: `dep1`,
          version: `1.0.0`,
        });
        await writeJson(npath.toPortablePath(`${path}/workspace/dep2/package.json`), {
          name: `dep2`,
          version: `1.0.0`,
        });

        await run(`install`);

        expect(await xfs.existsPromise(`${path}/node_modules/dep1` as PortablePath)).toEqual(false);
        expect(await xfs.existsPromise(`${path}/node_modules/dep2` as PortablePath)).toEqual(false);
        expect(await xfs.existsPromise(`${path}/workspace/node_modules/dep1` as PortablePath)).toEqual(true);
        expect(await xfs.existsPromise(`${path}/workspace/node_modules/dep2` as PortablePath)).toEqual(true);
        expect(await xfs.existsPromise(`${path}/node_modules/workspace` as PortablePath)).toEqual(false);
      },
    )
  );

  test(`should support dependencies hoist border`,
    // . -> workspace -> dep1 -> dep2 -> dep3
    // should be hoised to:
    // . -> workspace -> dep1 -> dep2
    //                        -> dep3
    makeTemporaryEnv(
      {
        private: true,
        workspaces: {
          packages: [`workspace`],
        },
      },
      {
        nodeLinker: `node-modules`,
      },
      async ({path, run, source}) => {
        await writeJson(npath.toPortablePath(`${path}/workspace/package.json`), {
          name: `workspace`,
          version: `1.0.0`,
          dependencies: {
            dep1: `file:./dep1`,
          },
          installConfig: {
            hoistingLimits: `dependencies`,
          },
        });
        await writeJson(npath.toPortablePath(`${path}/workspace/dep1/package.json`), {
          name: `dep1`,
          version: `1.0.0`,
          dependencies: {
            dep2: `file:../dep2`,
          },
        });
        await writeJson(npath.toPortablePath(`${path}/workspace/dep2/package.json`), {
          name: `dep2`,
          version: `1.0.0`,
          dependencies: {
            dep3: `file:../dep3`,
          },
        });
        await writeJson(npath.toPortablePath(`${path}/workspace/dep3/package.json`), {
          name: `dep3`,
          version: `1.0.0`,
        });

        await run(`install`);

        expect(await xfs.existsPromise(`${path}/node_modules/dep1` as PortablePath)).toEqual(false);
        expect(await xfs.existsPromise(`${path}/node_modules/dep2` as PortablePath)).toEqual(false);
        expect(await xfs.existsPromise(`${path}/node_modules/dep3` as PortablePath)).toEqual(false);
        expect(await xfs.existsPromise(`${path}/workspace/node_modules/dep1` as PortablePath)).toEqual(true);
        expect(await xfs.existsPromise(`${path}/workspace/node_modules/dep1/node_modules/dep2` as PortablePath)).toEqual(true);
        expect(await xfs.existsPromise(`${path}/workspace/node_modules/dep1/node_modules/dep3` as PortablePath)).toEqual(true);
        expect(await xfs.existsPromise(`${path}/node_modules/workspace` as PortablePath)).toEqual(false);
      },
    )
  );

  test(`should create symlink if workspace is a dependency AND it has hoist borders at the same time`,
    makeTemporaryEnv(
      {
        private: true,
        workspaces: [`workspace`],
        dependencies: {
          workspace: `workspace:*`,
        },
      },
      {
        nodeLinker: `node-modules`,
      },
      async ({path, run, source}) => {
        await writeJson(npath.toPortablePath(`${path}/workspace/package.json`), {
          name: `workspace`,
          version: `1.0.0`,
          dependencies: {
            dep: `file:./dep`,
          },
          installConfig: {
            hoistingLimits: `workspaces`,
          },
        });
        await writeJson(npath.toPortablePath(`${path}/workspace/dep/package.json`), {
          name: `dep`,
          version: `1.0.0`,
        });

        await run(`install`);

        expect(await xfs.existsPromise(`${path}/node_modules/dep` as PortablePath)).toEqual(false);
        expect(await xfs.existsPromise(`${path}/workspace/node_modules/dep` as PortablePath)).toEqual(true);
        // workspace symlink should be present at the top
        expect(await xfs.existsPromise(`${path}/node_modules/workspace` as PortablePath)).toEqual(true);
      },
    )
  );

  test(`should warn about 'nohoist' usage and retain nohoist field in the manifest`,
    makeTemporaryEnv(
      {
        private: true,
        workspaces: {
          nohoist: [`foo/**`],
        },
      },
      {
        nodeLinker: `node-modules`,
      },
      async ({path, run, source}) => {
        const stdout = (await run(`install`)).stdout;

        expect(stdout).toMatch(new RegExp(`'nohoist' is deprecated.*`));
        expect(await readJson(`${path}/package.json`)).toHaveProperty(`workspaces.nohoist`);
      },
    )
  );

  test(`should inherit workspace peer dependencies from upper-level workspaces`,
    // . -> foo(workspace) -> bar(workspace) --> no-deps@1
    //                     -> no-deps@1
    //   -> no-deps@2
    // bar must not be hoisted to the top, otherwise it will use no-deps@2 instead of no-deps@1
    // please note that bar directory must be nested inside foo directory,
    // otherwise with hoisting turned off bar will pick up no-deps@2
    makeTemporaryEnv(
      {
        private: true,
        workspaces: [`foo`],
        dependencies: {
          'no-deps': `2.0.0`,
        },
      },
      {
        nodeLinker: `node-modules`,
      },
      async ({path, run, source}) => {
        await writeJson(npath.toPortablePath(`${path}/foo/package.json`), {
          name: `foo`,
          version: `1.0.0`,
          workspaces: [`bar`],
          dependencies: {
            'no-deps': `1.0.0`,
          },
        });
        await writeJson(npath.toPortablePath(`${path}/foo/bar/package.json`), {
          name: `bar`,
          version: `1.0.0`,
          workspaces: [`bar`],
          peerDependencies: {
            'no-deps': `*`,
          },
        });

        await run(`install`);

        expect(await xfs.existsPromise(`${path}/node_modules/bar` as PortablePath)).toEqual(false);
        expect(await xfs.existsPromise(`${path}/foo/node_modules/bar` as PortablePath)).toEqual(true);
      },
    )
  );

  test(`should install dependencies in scoped workspaces`,
    makeTemporaryEnv(
      {
        private: true,
        workspaces: [`foo`],
      },
      {
        nodeLinker: `node-modules`,
      },
      async ({path, run, source}) => {
        await writeJson(npath.toPortablePath(`${path}/foo/package.json`), {
          name: `@scope/foo`,
          version: `1.0.0`,
          dependencies: {
            'no-deps': `1.0.0`,
          },
        });

        await run(`install`);

        expect(await xfs.existsPromise(`${path}/node_modules/@scope/foo` as PortablePath)).toEqual(true);
        expect(await xfs.existsPromise(`${path}/node_modules/no-deps` as PortablePath)).toEqual(true);
      },
    )
  );

  test(`should survive interrupted install`,
    makeTemporaryEnv(
      {
        private: true,
        workspaces: [`foo`],
      },
      {
        nodeLinker: `node-modules`,
      },
      async ({path, run, source}) => {
        await writeJson(npath.toPortablePath(`${path}/foo/package.json`), {
          name: `foo`,
          dependencies: {
            'has-bin-entries': `1.0.0`,
          },
        });

        await run(`install`);

        // Simulate interrupted install
        await xfs.removePromise(`${path}/node_modules/has-bin-entries` as PortablePath);

        await run(`add`, `has-bin-entries@2.0.0`);

        expect(await xfs.existsPromise(`${path}/node_modules/has-bin-entries/package.json` as PortablePath)).toEqual(true);
        expect(await xfs.existsPromise(`${path}/node_modules/has-bin-entries/index.js` as PortablePath)).toEqual(true);
        expect(await xfs.existsPromise(`${path}/foo/node_modules/has-bin-entries/package.json` as PortablePath)).toEqual(true);
      },
    )
  );

  test(`should respect peerDependencies with defaults in workspaces`,
    makeTemporaryEnv(
      {
        private: true,
        workspaces: [`foo`],
        dependencies: {
          'has-bin-entries': `2.0.0`,
        },
      },
      {
        nodeLinker: `node-modules`,
      },
      async ({path, run, source}) => {
        await writeJson(npath.toPortablePath(`${path}/foo/package.json`), {
          name: `foo`,
          peerDependencies: {
            'has-bin-entries': `*`,
          },
          devDependencies: {
            'has-bin-entries': `1.0.0`,
          },
        });

        await run(`install`);

        await expect(source(`require('foo/node_modules/has-bin-entries')`)).resolves.toMatchObject({
          version: `1.0.0`,
        });
      },
    )
  );

  test(`should allow running binaries unrelated to incompatible package`,
    makeTemporaryEnv(
      {
        private: true,
        dependencies: {
          dep: `file:./dep`,
          dep2: `file:./dep2`,
        },
      },
      {
        nodeLinker: `node-modules`,
      },
      async ({path, run}) => {
        await writeJson(ppath.resolve(path, `dep/package.json` as Filename), {
          name: `dep`,
          version: `1.0.0`,
          os: [`!${process.platform}`],
          bin: `./noop.js`,
        });
        await xfs.writeFilePromise(ppath.resolve(path, `dep/noop.js` as Filename), ``);

        await writeJson(ppath.resolve(path, `dep2/package.json` as Filename), {
          name: `dep2`,
          version: `1.0.0`,
          bin: `./echo.js`,
        });
        await xfs.writeFilePromise(ppath.resolve(path, `dep2/echo.js` as Filename), `console.log('echo')`);

        await run(`install`);

        await expect(run(`dep2`)).resolves.toMatchObject({stdout: `echo\n`});
      },
    ),
  );

  test(`should install dependencies from portals without modifying portal directory`,
    makeTemporaryEnv({},
      {
        nodeLinker: `node-modules`,
      },
      async ({path, run, source}) => {
        await xfs.mktempPromise(async portalTarget => {
          await xfs.writeJsonPromise(`${portalTarget}/package.json` as PortablePath, {
            name: `portal`,
            bin: `./index.js`,
            dependencies: {
              [`no-deps`]: `1.0.0`,
            },
          });
          await xfs.writeFilePromise(`${portalTarget}/index.js` as PortablePath, ``);
          const binScriptMode = (await xfs.lstatPromise(`${portalTarget}/index.js` as PortablePath)).mode;

          await xfs.writeJsonPromise(`${path}/package.json` as PortablePath, {
            dependencies: {
              [`portal`]: `portal:${portalTarget}`,
            },
          });

          const {stdout} = await run(`install`);

          await expect(readJson(`${path}/node_modules/portal/package.json` as PortablePath)).resolves.toMatchObject({
            name: `portal`,
          });
          await expect(source(`require('no-deps')`)).resolves.toMatchObject({
            version: `1.0.0`,
          });
          expect(stdout).toMatch(new RegExp(`--preserve-symlinks`));
          expect(await xfs.existsPromise(`${portalTarget}/node_modules` as PortablePath)).toBeFalsy();
          expect((await xfs.lstatPromise(`${portalTarget}/index.js` as PortablePath)).mode).toEqual(binScriptMode);
        });
      })
  );

  test(`should error out on external portal requiring a dependency that conflicts with parent package`,
    makeTemporaryEnv({},
      {
        nodeLinker: `node-modules`,
      },
      async ({path, run}) => {
        await xfs.mktempPromise(async portalTarget => {
          await xfs.writeJsonPromise(`${portalTarget}/package.json` as PortablePath, {
            name: `portal`,
            dependencies: {
              [`no-deps`]: `2.0.0`,
            },
          });

          await xfs.writeJsonPromise(`${path}/package.json` as PortablePath, {
            dependencies: {
              portal: `portal:${portalTarget}`,
              'no-deps': `1.0.0`,
            },
          });

          let stdout;
          try {
            await run(`install`);
          } catch (e) {
            stdout = e.stdout;
          }

          expect(stdout).toMatch(new RegExp(`dependency no-deps@npm:2.0.0 conflicts with parent dependency no-deps@npm:1.0.0`));
        });
      })
  );

  test(
    `should not warn when depending on workspaces with postinstall`,
    makeTemporaryEnv(
      {
        workspaces: [`dep`],
        dependencies: {
          dep: `workspace:*`,
        },
      },
      {
        nodeLinker: `node-modules`,
      },
      async ({path, run}) => {
        await writeJson(`${path}/dep/package.json`, {
          name: `dep`,
          scripts: {
            postinstall: `echo 'dep'`,
          },
        });

        const {stdout} = await run(`install`);

        expect(stdout).not.toContain(`YN0006`);
      })
  );

  test(`should not error out on internal portal requiring a dependency that conflicts with parent package`,
    makeTemporaryEnv({
      dependencies: {
        portal: `portal:./portal`,
        'no-deps': `1.0.0`,
      },
    },
    {
      nodeLinker: `node-modules`,
    },
    async ({path, run}) => {
      await writeJson(`${path}/portal/package.json` as PortablePath, {
        name: `portal`,
        dependencies: {
          [`no-deps`]: `2.0.0`,
        },
      });

      await expect(async () => await run(`install`)).not.toThrow();
    })
  );
});
