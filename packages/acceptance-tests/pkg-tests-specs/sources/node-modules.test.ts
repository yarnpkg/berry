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
    ),
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
    ),
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

        // We shouldn't show logs when a package is skipped because they get really spammy when a package has a lot of conditional deps
        expect(stdout).not.toMatch(new RegExp(`dep@file:./dep.*The ${process.platform}-${process.arch} architecture is incompatible with this module, link skipped.`));

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
    ),
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
    ),
  );

  test(`should respect self references settings`,
    makeTemporaryEnv(
      {
        workspaces: [`ws1`, `ws2`],
      },
      {
        nodeLinker: `node-modules`,
        nmSelfReferences: false,
      },
      async ({path, run}) => {
        await writeJson(npath.toPortablePath(`${path}/ws1/package.json`), {
          name: `ws1`,
          installConfig: {
            selfReferences: true,
          },
        });
        await writeJson(npath.toPortablePath(`${path}/ws2/package.json`), {
          name: `ws2`,
        });

        await run(`install`);

        expect(await xfs.existsPromise(`${path}/node_modules/ws1` as PortablePath)).toEqual(true);
        expect(await xfs.existsPromise(`${path}/node_modules/ws2` as PortablePath)).toEqual(false);
      },
    ),
  );

  test(`should not create self-reference symlinks for workspaces excluded from focus`,
    makeTemporaryEnv(
      {
        workspaces: [`ws1`, `ws2`],
      },
      {
        nodeLinker: `node-modules`,
        plugins: [require.resolve(`@yarnpkg/monorepo/scripts/plugin-workspace-tools.js`)],
      },
      async ({path, run}) => {
        await writeJson(npath.toPortablePath(`${path}/ws1/package.json`), {
          name: `ws1`,
        });
        await writeJson(npath.toPortablePath(`${path}/ws2/package.json`), {
          name: `ws2`,
        });

        await run(`workspaces`, `focus`, `ws2`);

        expect(await xfs.existsPromise(`${path}/node_modules/ws1` as PortablePath)).toEqual(false);
        expect(await xfs.existsPromise(`${path}/node_modules/ws2` as PortablePath)).toEqual(true);
      },
    ),
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
    ),
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
    ),
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
    ),
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
    ),
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
      async ({path, run}) => {
        await writeJson(npath.toPortablePath(`${path}/foo/package.json`), {
          name: `foo`,
          workspaces: [`bar`],
          dependencies: {
            bar: `workspace:*`,
            'no-deps': `1.0.0`,
          },
        });
        await writeJson(npath.toPortablePath(`${path}/foo/bar/package.json`), {
          name: `bar`,
          peerDependencies: {
            'no-deps': `*`,
          },
        });

        await run(`install`);

        expect(await xfs.existsPromise(`${path}/node_modules/bar` as PortablePath)).toEqual(false);
        expect(await xfs.existsPromise(`${path}/foo/node_modules/bar` as PortablePath)).toEqual(true);
      },
    ),
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
    ),
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
    ),
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
    ),
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
      }),
  );

  test(`should still hoist direct dependencies from portal target to parent with nmHoistingLimits: dependencies`,
    makeTemporaryEnv({},
      {
        nodeLinker: `node-modules`,
        nmHoistingLimits: `dependencies`,
      },
      async ({path, run, source}) => {
        await xfs.mktempPromise(async portalTarget => {
          await xfs.writeJsonPromise(`${portalTarget}/package.json` as PortablePath, {
            name: `portal`,
            dependencies: {
              [`one-fixed-dep`]: `1.0.0`,
            },
          });
          await xfs.writeJsonPromise(`${path}/package.json` as PortablePath, {
            dependencies: {
              [`portal`]: `portal:${portalTarget}`,
            },
          });

          const {stdout} = await run(`install`);

          await expect(source(`require('one-fixed-dep')`)).resolves.toMatchObject({
            version: `1.0.0`,
          });
          expect(stdout).toMatch(new RegExp(`--preserve-symlinks`));
          expect(await xfs.existsPromise(`${portalTarget}/node_modules` as PortablePath)).toBeFalsy();
          expect(await xfs.existsPromise(`${path}/node_modules/no-deps` as PortablePath)).toBeFalsy();
        });
      }),
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
              'no-deps': `2.0.0`,
            },
            peerDependencies: {
              'no-deps-bins': `1.0.0`,
            },
          });

          await xfs.writeJsonPromise(`${path}/package.json` as PortablePath, {
            dependencies: {
              portal: `portal:${portalTarget}`,
              'no-deps': `1.0.0`,
              'no-deps-bins': `1.0.0`,
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
      }),
  );

  test(`should error out if two same-parent portals have conflict between their direct dependencies`,
    makeTemporaryEnv({},
      {
        nodeLinker: `node-modules`,
      },
      async ({path, run}) => {
        await xfs.mktempPromise(async portalTarget1 => {
          await xfs.mktempPromise(async portalTarget2 => {
            await xfs.writeJsonPromise(`${portalTarget1}/package.json` as PortablePath, {
              name: `portal1`,
              dependencies: {
                'no-deps': `2.0.0`,
              },
            });
            await xfs.writeJsonPromise(`${portalTarget2}/package.json` as PortablePath, {
              name: `portal2`,
              dependencies: {
                'no-deps': `1.0.0`,
              },
            });

            await xfs.writeJsonPromise(`${path}/package.json` as PortablePath, {
              dependencies: {
                portal1: `portal:${portalTarget1}`,
                portal2: `portal:${portalTarget2}`,
              },
            });

            let stdout;
            try {
              await run(`install`);
            } catch (e) {
              stdout = e.stdout;
            }

            expect(stdout).toMatch(new RegExp(`dependency no-deps@npm:1.0.0 conflicts with dependency no-deps@npm:2.0.0 from sibling portal portal1`));
          });
        });
      }),
  );

  test(`should not error out if one of two same-parent portals has unresolved peer dependency, while the other has resolved dependency with the same name`,
    makeTemporaryEnv({},
      {
        nodeLinker: `node-modules`,
      },
      async ({path, run}) => {
        await xfs.mktempPromise(async portalTarget1 => {
          await xfs.mktempPromise(async portalTarget2 => {
            await xfs.writeJsonPromise(`${portalTarget1}/package.json` as PortablePath, {
              name: `portal1`,
              peerDependencies: {
                'no-deps': `2.0.0`,
              },
            });
            await xfs.writeJsonPromise(`${portalTarget2}/package.json` as PortablePath, {
              name: `portal2`,
              dependencies: {
                'no-deps': `1.0.0`,
              },
            });

            await xfs.writeJsonPromise(`${path}/package.json` as PortablePath, {
              dependencies: {
                portal1: `portal:${portalTarget1}`,
                portal2: `portal:${portalTarget2}`,
              },
            });

            await expect(run(`install`)).resolves.not.toThrow();
          });
        });
      }),
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
      }),
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

      await expect(run(`install`)).resolves.not.toThrow();
    }),
  );

  test(`should give a priority to direct portal dependencies over indirect regular dependencies`,
    makeTemporaryEnv({},
      {
        nodeLinker: `node-modules`,
      },
      async ({path, run}) => {
        await xfs.mktempPromise(async portalTarget => {
          await xfs.writeJsonPromise(`${portalTarget}/package.json` as PortablePath, {
            name: `portal`,
            dependencies: {
              'no-deps': `2.0.0`,
            },
          });

          await xfs.writeJsonPromise(`${path}/package.json` as PortablePath, {
            dependencies: {
              portal: `portal:${portalTarget}`,
              'one-fixed-dep': `1.0.0`,
              'one-range-dep': `1.0.0`,
            },
          });

          await expect(run(`install`)).resolves.not.toThrow();
        });
      }),
  );

  test(
    `should not hoist dependencies in nested workspaces when using nmHoistingLimits`,
    makeTemporaryEnv(
      {
        workspaces: [`workspace-a`],
        dependencies: {
          [`no-deps`]: `*`,
        },
      },
      {
        nodeLinker: `node-modules`,
        nmHoistingLimits: `workspaces`,
      },
      async ({path, run}) => {
        await writeJson(`${path}/workspace-a/package.json`, {
          workspaces: [`workspace-b`],
          dependencies: {
            [`no-deps`]: `*`,
          },
        });

        await writeJson(`${path}/workspace-a/workspace-b/package.json`, {
          dependencies: {
            [`no-deps`]: `*`,
          },
        });

        await run(`install`);

        await expect(xfs.existsPromise(`${path}/node_modules/no-deps` as PortablePath)).resolves.toEqual(true);
        await expect(xfs.existsPromise(`${path}/workspace-a/node_modules/no-deps` as PortablePath)).resolves.toEqual(true);
        await expect(xfs.existsPromise(`${path}/workspace-a/workspace-b/node_modules/no-deps` as PortablePath)).resolves.toEqual(true);
      },
    ),
  );

  test(
    `should prefer bin executables from the calling workspace`,
    makeTemporaryEnv(
      {
        workspaces: [`workspace-a`, `workspace-b`, `workspace-c`],
        dependencies: {
          [`node-modules-path`]: `1.0.0`,
        },
        scripts: {
          wa: `yarn ./workspace-a get-node-modules-path`,
          wb: `yarn ./workspace-b get-node-modules-path`,
          wc: `yarn ./workspace-c get-node-modules-path`,
        },
      },
      {
        nodeLinker: `node-modules`,
      },
      async ({path, run}) => {
        await writeJson(`${path}/workspace-a/package.json`, {
          name: `workspace-a`,
          dependencies: {
            [`node-modules-path`]: `2.0.0`,
          },
        });

        await writeJson(`${path}/workspace-b/package.json`, {
          name: `workspace-b`,
          dependencies: {
            [`node-modules-path`]: `2.0.0`,
          },
        });
        await writeJson(`${path}/workspace-c/package.json`, {
          name: `workspace-c`,
          dependencies: {
            [`node-modules-path`]: `2.0.0`,
          },
        });

        await run(`install`);

        await expect(xfs.existsPromise(`${path}/node_modules/node-modules-path` as PortablePath)).resolves.toEqual(true);
        await expect(xfs.existsPromise(`${path}/workspace-a/node_modules/node-modules-path` as PortablePath)).resolves.toEqual(true);
        await expect(xfs.existsPromise(`${path}/workspace-b/node_modules/node-modules-path` as PortablePath)).resolves.toEqual(true);
        await expect(xfs.existsPromise(`${path}/workspace-c/node_modules/node-modules-path` as PortablePath)).resolves.toEqual(true);

        expect((await run(`run`, `wb`)).stdout.trim()).toContain(`workspace-b`);
        expect((await run(`run`, `wa`)).stdout.trim()).toContain(`workspace-a`);
        expect((await run(`run`, `wc`)).stdout.trim()).toContain(`workspace-c`);
      },
    ),
  );

  test(`should honor transparently nmMode: hardlinks during subsequent installs`,
    makeTemporaryEnv(
      {
        workspaces: [`ws1`, `ws2`, `ws3`],
        dependencies: {
          [`no-deps`]: `1.0.0`,
        },
      },
      async ({path, run}) => {
        await writeJson(`${path}/ws1/package.json`, {
          dependencies: {
            [`no-deps`]: `1.0.0`,
          },
        });

        await writeJson(`${path}/ws2/package.json`, {
          dependencies: {
            [`no-deps`]: `2.0.0`,
          },
        });

        await writeJson(`${path}/ws3/package.json`, {
          dependencies: {
            [`no-deps`]: `2.0.0`,
          },
        });

        await writeFile(`${path}/.yarnrc.yml`, `nodeLinker: node-modules\nnmMode: hardlinks-local\n`);
        await run(`install`);

        expect(await xfs.statPromise(`${path}/ws3/node_modules/no-deps/package.json` as PortablePath)).toMatchObject({nlink: 2});

        await writeFile(`${path}/.yarnrc.yml`, `nodeLinker: node-modules\nnmMode: classic\n`);
        await run(`install`);

        expect(await xfs.statPromise(`${path}/ws3/node_modules/no-deps/package.json` as PortablePath)).toMatchObject({nlink: 1});

        await writeFile(`${path}/.yarnrc.yml`, `nodeLinker: node-modules\nnmMode: hardlinks-local\n`);
        await run(`install`);

        expect(await xfs.statPromise(`${path}/ws3/node_modules/no-deps/package.json` as PortablePath)).toMatchObject({nlink: 2});
      },
    ),
  );

  test(`should wire via hardlinks files having the same content when in nmMode: hardlinks-global`,
    makeTemporaryEnv(
      {
        dependencies: {
          dep1: `file:./dep1`,
          dep2: `file:./dep2`,
        },
      },
      {
        nodeLinker: `node-modules`,
        nmMode: `hardlinks-global`,
      },
      async ({path, run}) => {
        await writeJson(ppath.resolve(path, `dep1/package.json` as Filename), {
          name: `dep1`,
          version: `1.0.0`,
        });

        const content = `The same content`;
        await xfs.writeFilePromise(ppath.resolve(path, `dep1/index.js` as Filename), content);

        await writeJson(ppath.resolve(path, `dep2/package.json` as Filename), {
          name: `dep2`,
          version: `1.0.0`,
        });
        await xfs.writeFilePromise(ppath.resolve(path, `dep2/index.js` as Filename), content);

        await run(`install`);

        const stats1 = await xfs.statPromise(`${path}/node_modules/dep1/index.js` as PortablePath);
        const stats2 = await xfs.statPromise(`${path}/node_modules/dep2/index.js` as PortablePath);

        expect(stats1.ino).toEqual(stats2.ino);
      },
    ),
  );

  test(`should recover from changes to the store on next install in nmMode: cas`,
    makeTemporaryEnv(
      {
        dependencies: {
          dep: `file:./dep`,
        },
      },
      {
        nodeLinker: `node-modules`,
        nmMode: `hardlinks-global`,
      },
      async ({path, run}) => {
        await writeJson(ppath.resolve(path, `dep/package.json` as Filename), {
          name: `dep`,
          version: `1.0.0`,
        });

        const originalContent = `The same content`;
        await xfs.writeFilePromise(ppath.resolve(path, `dep/index.js` as Filename), originalContent);

        await run(`install`);

        const modifiedContent = `The modified content`;
        const depNmPath = ppath.resolve(path, `node_modules/dep/index.js` as Filename);
        await xfs.writeFilePromise(depNmPath, modifiedContent);

        await xfs.removePromise(ppath.resolve(path, `node_modules` as Filename));

        await run(`install`);

        const depContent = await xfs.readFilePromise(depNmPath, `utf8`);
        expect(depContent).toEqual(originalContent);
      },
    ),
  );

  test(`should give priority to direct workspace dependencies over indirect regular dependencies`,
    // Despite 'one-fixed-dep' and 'has-bin-entries' depend on 'no-deps:1.0.0',
    // the 'no-deps:2.0.0' should be hoisted to the top-level
    makeTemporaryEnv(
      {
        workspaces: [`ws1`, `ws2`],
        dependencies: {
          [`one-fixed-dep`]: `1.0.0`,
        },
      },
      {
        nodeLinker: `node-modules`,
      },
      async ({path, run, source}) => {
        await writeJson(`${path}/ws1/package.json`, {
          dependencies: {
            [`no-deps`]: `2.0.0`,
          },
        });
        await writeJson(`${path}/ws2/package.json`, {
          dependencies: {
            [`has-bin-entries`]: `1.0.0`,
          },
        });

        await run(`install`);

        await expect(source(`require('no-deps')`)).resolves.toMatchObject({
          version: `2.0.0`,
        });
      },
    ),
  );

  test(
    `should fallback to dependencies if the parent doesn't provide the peer dependency`,
    makeTemporaryEnv(
      {},
      {
        nodeLinker: `node-modules`,
      },
      async ({path, run}) => {
        const appPath = ppath.join(path, `lib-1` as Filename);
        const libPath = ppath.join(path, `lib-2` as Filename);

        await xfs.mkdirPromise(libPath);
        await xfs.writeJsonPromise(ppath.join(libPath, Filename.manifest), {
          dependencies: {
            [`no-deps`]: `*`,
          },
          peerDependencies: {
            [`no-deps`]: `*`,
          },
        });

        await xfs.mkdirPromise(appPath);
        await xfs.writeJsonPromise(ppath.join(appPath, Filename.manifest), {
          dependencies: {
            [`lib`]: `portal:${libPath}`,
          },
          peerDependencies: {
            [`no-deps`]: `*`,
          },
        });

        await xfs.writeJsonPromise(ppath.join(path, Filename.manifest), {
          dependencies: {
            [`app`]: `portal:${appPath}`,
          },
        });

        await run(`install`);

        await expect(xfs.existsPromise(ppath.join(path, `node_modules/no-deps` as PortablePath))).resolves.toEqual(true);
      },
    ),
  );

  it(`should not create self-referencing symlinks for anonymous workspaces`,
    makeTemporaryEnv(
      {
      },
      {
        nodeLinker: `node-modules`,
      },
      async ({path, run}) => {
        await run(`install`);

        const entries = await xfs.readdirPromise(ppath.join(path, `node_modules` as Filename), {withFileTypes: true});
        let symlinkCount = 0;
        for (const entry of entries) {
          if (entry.isSymbolicLink()) {
            symlinkCount++;
          }
        }

        expect(symlinkCount).toBe(0);
      },
    ),
  );

  it(`should properly hoist nested workspaces`,
    makeTemporaryEnv(
      {
        workspaces: [`ws`, `ws/nested1`, `ws/nested1/nested2`],
        dependencies: {
          ws: `workspace:*`,
          nested1: `workspace:*`,
          nested2: `workspace:*`,
        },
      },
      {
        nodeLinker: `node-modules`,
      },
      async ({path, run, source}) => {
        await xfs.mkdirpPromise(ppath.join(path, `ws/nested1/nested2` as PortablePath));

        await xfs.writeJsonPromise(ppath.join(path, `ws/${Filename.manifest}` as PortablePath), {
          name: `ws`,
          dependencies: {
            [`no-deps`]: `1.0.0`,
          },
        });

        await xfs.writeJsonPromise(ppath.join(path, `ws/nested1/${Filename.manifest}` as PortablePath), {
          name: `nested1`,
          dependencies: {
            [`no-deps`]: `2.0.0`,
          },
        });

        await xfs.writeJsonPromise(ppath.join(path, `ws/nested1/nested2/${Filename.manifest}` as PortablePath), {
          name: `nested2`,
          dependencies: {
            [`no-deps`]: `2.0.0`,
          },
        });

        await run(`install`);

        await expect(source(`require('no-deps')`)).resolves.toMatchObject({
          version: `1.0.0`,
        });
        await expect(source(`require('module').createRequire(require.resolve('nested1/package.json') + '/..')('no-deps')`)).resolves.toMatchObject({
          version: `2.0.0`,
        });
      },
    ),
  );

  it(`should handle the edge case when node_modules is a file`, () => {
    makeTemporaryEnv(
      {
        private: true,
        dependencies: {
          'no-deps': `1.0.0`,
        },
      },
      {
        nodeLinker: `node-modules`,
      },
      async ({path, run, source}) => {
        await xfs.writeFilePromise(ppath.resolve(path, `node_modules` as Filename), ``);

        await run(`install`);

        await expect(source(`require('no-deps')`)).resolves.toEqual({
          name: `no-deps`,
          version: `1.0.0`,
        });
      },
    );
  });

  it(`should tolerate if node_modules is a symlink to other directory`, () => {
    makeTemporaryEnv(
      {
        private: true,
        dependencies: {
          'no-deps': `1.0.0`,
        },
      },
      {
        nodeLinker: `node-modules`,
      },
      async ({path, run}) => {
        const nmDir = ppath.resolve(path, `node_modules` as Filename);
        const trueInstallDir = ppath.resolve(path, `target` as Filename);
        await xfs.mkdirPromise(trueInstallDir);
        await xfs.symlinkPromise(trueInstallDir, nmDir);

        await run(`install`);

        expect((await xfs.lstatPromise(nmDir)).isSymbolicLink()).toBeTruthy();
        expect(await xfs.existsSync(ppath.join(trueInstallDir, `no-deps` as Filename))).toBeTruthy();
      },
    );
  });

  it(`should install project when portal is pointing to a workspace`,
    makeTemporaryEnv(
      {
        workspaces: [`ws1`, `ws2`],
      },
      {
        nodeLinker: `node-modules`,
      },
      async ({path, run, source}) => {
        await xfs.mkdirpPromise(ppath.join(path, `ws1` as PortablePath));
        await xfs.writeJsonPromise(ppath.join(path, `ws1/${Filename.manifest}` as PortablePath), {
          name: `ws1`,
          devDependencies: {
            [`no-deps`]: `1.0.0`,
          },
        });
        await xfs.mkdirpPromise(ppath.join(path, `ws2` as PortablePath));
        await xfs.writeJsonPromise(ppath.join(path, `ws2/${Filename.manifest}` as PortablePath), {
          name: `ws2`,
          devDependencies: {
            [`ws1`]: `portal:../ws1`,
          },
        });

        await run(`install`);

        await expect(source(`require('no-deps')`)).resolves.toMatchObject({
          version: `1.0.0`,
        });
      },
    ),
  );

  it(`should install project when portal is used from the child workspace and have conflicts with root workspace dependencies`,
    // portal dependencies should be hoisted first and only after that portal hoisting should happen, not vice versa
    // as a result the install in this case should finish successfully
    makeTemporaryEnv(
      {
        workspaces: [`ws`],
        dependencies: {
          'no-deps': `1.0.0`,
        },
      },
      {
        nodeLinker: `node-modules`,
      },
      async ({path, run}) => {
        await xfs.mktempPromise(async portalTarget => {
          await xfs.mkdirpPromise(ppath.join(path, `ws` as PortablePath));
          await xfs.writeJsonPromise(`${path}/ws/package.json` as PortablePath, {
            dependencies: {
              portal: `portal:${portalTarget}`,
            },
          });

          await xfs.writeJsonPromise(`${portalTarget}/package.json` as PortablePath, {
            name: `portal`,
            dependencies: {
              'no-deps': `2.0.0`,
            },
          });

          await expect(run(`install`)).resolves.not.toThrow();
        });
      }),
  );
});
