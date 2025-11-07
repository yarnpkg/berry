const {npath, ppath, xfs, Filename} = require(`@yarnpkg/fslib`);
const cp = require(`child_process`);

const {
  fs: {writeFile, writeJson},
  tests: {getPackageDirectoryPath, testIf},
} = require(`pkg-tests-core`);

describe(`Pnpm`, () => {
  test(
    `it should resolve two identical packages with the same object (easy)`,
    makeTemporaryEnv(
      {
        dependencies: {
          [`one-fixed-dep-1`]: getPackageDirectoryPath(`one-fixed-dep`, `1.0.0`),
          [`one-fixed-dep-2`]: getPackageDirectoryPath(`one-fixed-dep`, `1.0.0`),
          [`no-deps`]: `1.0.0`,
        },
      },
      {
        nodeLinker: `pnpm`,
      },
      async ({path, run, source}) => {
        await run(`install`);

        await expect(
          source(`require('one-fixed-dep-1').dependencies['no-deps'] === require('no-deps')`),
        ).resolves.toEqual(true);
        await expect(
          source(`require('one-fixed-dep-2').dependencies['no-deps'] === require('no-deps')`),
        ).resolves.toEqual(true);
      },
    ),
  );

  test(
    `it should resolve two identical packages with the same object (complex)`,
    makeTemporaryEnv(
      {
        dependencies: {
          [`one-fixed-dep-1`]: getPackageDirectoryPath(`one-fixed-dep`, `1.0.0`),
          [`one-fixed-dep-2`]: getPackageDirectoryPath(`one-fixed-dep`, `1.0.0`),
          [`no-deps`]: `2.0.0`,
        },
      },
      {
        nodeLinker: `pnpm`,
      },
      async ({path, run, source}) => {
        await run(`install`);

        await expect(
          source(
            `require('one-fixed-dep-1').dependencies['no-deps'] === require('one-fixed-dep-2').dependencies['no-deps']`,
          ),
        ).resolves.toEqual(true);

        await expect(
          source(`require('one-fixed-dep-1').dependencies['no-deps'] !== require('no-deps')`),
        ).resolves.toEqual(true);
        await expect(
          source(`require('one-fixed-dep-2').dependencies['no-deps'] !== require('no-deps')`),
        ).resolves.toEqual(true);
      },
    ),
  );

  test(
    `it should fallback to the top-level dependencies when it cannot require a transitive dependency require`,
    makeTemporaryEnv(
      {
        dependencies: {[`various-requires`]: `1.0.0`, [`no-deps`]: `1.0.0`},
      },
      {
        nodeLinker: `pnpm`,
      },
      async ({path, run, source}) => {
        await run(`install`);

        await expect(source(`require('various-requires/invalid-require')`)).resolves.toMatchObject({
          name: `no-deps`,
          version: `1.0.0`,
        });
      },
    ),
  );

  test(
    `it shouldn't print warning in the default install mode, even when the fallback is used`,
    makeTemporaryEnv(
      {
        dependencies: {[`various-requires`]: `1.0.0`, [`no-deps`]: `1.0.0`},
      },
      {
        nodeLinker: `pnpm`,
      },
      async ({path, run, source}) => {
        await run(`install`);

        await expect(run(`node`, `-e`, `require('various-requires/invalid-require')`)).resolves.toMatchObject({
          stderr: ``,
        });
      },
    ),
  );

  test(
    `it should throw an exception if a dependency tries to require something it doesn't own`,
    makeTemporaryEnv(
      {dependencies: {[`various-requires`]: `1.0.0`}},
      {
        nodeLinker: `pnpm`,
      },
      async ({path, run, source}) => {
        await run(`install`);

        await expect(source(`require('various-requires/invalid-require')`)).rejects.toMatchObject({
          externalException: {
            code: `MODULE_NOT_FOUND`,
          },
        });
      },
    ),
  );

  test(
    `it should throw an exception if a workspace tries to require something it doesn't own`,
    makeTemporaryEnv(
      {
        private: true,
        workspaces: [`packages/*`],
        dependencies: {[`various-requires`]: `1.0.0`},
      },
      {
        nodeLinker: `pnpm`,
      },
      async ({path, run, source}) => {
        const workspacePath = ppath.join(path, `packages/workspace-a`);

        await xfs.mkdirpPromise(workspacePath);
        await xfs.writeJsonPromise(ppath.join(workspacePath, `package.json`), {name: `workspace-a`});

        await run(`install`);

        await expect(source(`require('no-deps')`, {cwd: ppath.join(workspacePath)})).rejects.toMatchObject({
          externalException: {
            code: `MODULE_NOT_FOUND`,
          },
        });
      },
    ),
  );

  test(
    `it should throw an exception if a dependency tries to require a missing peer dependency`,
    makeTemporaryEnv(
      {dependencies: {[`peer-deps`]: `1.0.0`}},
      {
        nodeLinker: `pnpm`,
      },
      async ({path, run, source}) => {
        await run(`install`);

        await expect(source(`require('peer-deps')`)).rejects.toMatchObject({
          externalException: {
            code: `MODULE_NOT_FOUND`,
          },
        });
      },
    ),
  );

  test(
    `it should implicitly allow @types accesses if there are matching peer dependencies`,
    makeTemporaryEnv(
      {
        dependencies: {
          [`@types/no-deps`]: `1.0.0`,
          [`peer-deps`]: `1.0.0`,
        },
      },
      {
        nodeLinker: `pnpm`,
      },
      async ({path, run, source}) => {
        await run(`install`);

        await expect(source(`require('peer-deps/get-types')`)).resolves.toMatchObject({
          name: `@types/no-deps`,
          version: `1.0.0`,
        });
      },
    ),
  );

  test(
    `it should allow packages to require themselves`,
    makeTemporaryEnv(
      {
        dependencies: {[`various-requires`]: `1.0.0`},
      },
      {
        nodeLinker: `pnpm`,
      },
      async ({path, run, source}) => {
        await run(`install`);

        await expect(source(`require('various-requires/self') === require('various-requires')`)).resolves.toEqual(true);
      },
    ),
  );

  test(
    `it should run scripts using a Node version that auto-injects the hook`,
    makeTemporaryEnv(
      {
        dependencies: {[`no-deps`]: `1.0.0`},
        scripts: {myScript: `node -p "require('no-deps/package.json').version"`},
      },
      {
        nodeLinker: `pnpm`,
      },
      async ({path, run}) => {
        await run(`install`);

        await expect(run(`myScript`)).resolves.toMatchObject({
          stdout: `1.0.0\n`,
        });
      },
    ),
  );

  test(
    `it should not warn when the peer dependency resolution is compatible`,
    makeTemporaryEnv(
      {
        dependencies: {
          [`peer-deps-fixed`]: `1.0.0`,
          [`no-deps`]: `1.0.0`,
        },
      },
      {
        nodeLinker: `pnpm`,
      },
      async ({path, run, source}) => {
        const {stdout} = await run(`install`);
        expect(stdout).not.toEqual(expect.stringContaining(`YN0060`));
      },
    ),
  );

  test(
    `it should warn when the peer dependency resolution is incompatible`,
    makeTemporaryEnv(
      {
        dependencies: {
          [`peer-deps-fixed`]: `1.0.0`,
          [`no-deps`]: `2.0.0`,
        },
      },
      {
        nodeLinker: `pnpm`,
      },
      async ({path, run, source}) => {
        const {stdout} = await run(`install`);
        expect(stdout).toEqual(expect.stringContaining(`YN0060`));
      },
    ),
  );

  test(
    `it should install in such a way that two identical packages with different peer dependencies are different instances`,
    makeTemporaryEnv(
      {
        dependencies: {
          [`provides-peer-deps-1-0-0`]: `1.0.0`,
          [`provides-peer-deps-2-0-0`]: `1.0.0`,
        },
      },
      {
        nodeLinker: `pnpm`,
      },
      async ({path, run, source}) => {
        await run(`install`);

        await expect(
          source(`require('provides-peer-deps-1-0-0').dependencies['peer-deps'] === require('provides-peer-deps-2-0-0').dependencies['peer-deps']`),
        ).resolves.toEqual(false);

        await expect(source(`require('provides-peer-deps-1-0-0')`)).resolves.toMatchObject({
          name: `provides-peer-deps-1-0-0`,
          version: `1.0.0`,
          dependencies: {
            [`peer-deps`]: {
              name: `peer-deps`,
              version: `1.0.0`,
              peerDependencies: {
                [`no-deps`]: {
                  name: `no-deps`,
                  version: `1.0.0`,
                },
              },
            },
            [`no-deps`]: {
              name: `no-deps`,
              version: `1.0.0`,
            },
          },
        });

        await expect(source(`require('provides-peer-deps-2-0-0')`)).resolves.toMatchObject({
          name: `provides-peer-deps-2-0-0`,
          version: `1.0.0`,
          dependencies: {
            [`peer-deps`]: {
              name: `peer-deps`,
              version: `1.0.0`,
              peerDependencies: {
                [`no-deps`]: {
                  name: `no-deps`,
                  version: `2.0.0`,
                },
              },
            },
            [`no-deps`]: {
              name: `no-deps`,
              version: `2.0.0`,
            },
          },
        });
      },
    ),
  );

  test(
    `it should install in such a way that two identical packages with the same peer dependencies are the same instances (simple)`,
    makeTemporaryEnv(
      {
        dependencies: {
          [`provides-peer-deps-1-0-0`]: `1.0.0`,
          [`provides-peer-deps-1-0-0-too`]: `1.0.0`,
        },
      },
      {
        nodeLinker: `pnpm`,
      },
      async ({path, run, source}) => {
        await run(`install`);

        await expect(
          source(`require('provides-peer-deps-1-0-0').dependencies['peer-deps'] === require('provides-peer-deps-1-0-0-too').dependencies['peer-deps']`),
        ).resolves.toEqual(true);
      },
    ),
  );

  test(
    `it should install in such a way that two identical packages with the same peer dependencies are the same instances (complex)`,
    makeTemporaryEnv(
      {
        dependencies: {
          [`forward-peer-deps`]: `1.0.0`,
          [`forward-peer-deps-too`]: `1.0.0`,
          [`no-deps`]: `1.0.0`,
        },
      },
      {
        nodeLinker: `pnpm`,
      },
      async ({path, run, source}) => {
        await run(`install`);

        await expect(
          source(`require('forward-peer-deps').dependencies['peer-deps'] === require('forward-peer-deps-too').dependencies['peer-deps']`),
        ).resolves.toEqual(true);
      },
    ),
  );

  test(
    `it shouldn't deduplicate two packages with similar peer dependencies but different names`,
    makeTemporaryEnv(
      {
        dependencies: {
          [`peer-deps`]: `1.0.0`,
          [`peer-deps-too`]: `1.0.0`,
          [`no-deps`]: `1.0.0`,
        },
      },
      {
        nodeLinker: `pnpm`,
      },
      async ({path, run, source}) => {
        await run(`install`);

        await expect(
          source(`require('peer-deps') === require('peer-deps-too')`),
        ).resolves.toEqual(false);
      },
    ),
  );

  test(
    `it should not break the tree path when loading through the result of require.resolve(...)`,
    makeTemporaryEnv(
      {
        dependencies: {[`custom-dep-a`]: `file:./custom-dep-a`},
      },
      {
        nodeLinker: `pnpm`,
      },
      async ({path, run, source}) => {
        await writeFile(
          `${path}/custom-dep-a/index.js`,
          `module.exports = require('custom-dep-b')(require.resolve('custom-dep-c'))`,
        );
        await writeJson(`${path}/custom-dep-a/package.json`, {
          name: `custom-dep-a`,
          version: `1.0.0`,
          dependencies: {[`custom-dep-b`]: `file:../custom-dep-b`, [`custom-dep-c`]: `file:../custom-dep-c`},
        });

        await writeFile(`${path}/custom-dep-b/index.js`, `module.exports = path => require(path)`);
        await writeJson(`${path}/custom-dep-b/package.json`, {name: `custom-dep-b`, version: `1.0.0`});

        await writeFile(`${path}/custom-dep-c/index.js`, `module.exports = require('no-deps')`);
        await writeJson(`${path}/custom-dep-c/package.json`, {
          name: `custom-dep-c`,
          version: `1.0.0`,
          dependencies: {[`no-deps`]: `1.0.0`},
        });

        await run(`install`);

        await expect(source(`require('custom-dep-a')`)).resolves.toMatchObject({
          name: `no-deps`,
          version: `1.0.0`,
        });
      },
    ),
  );

  test(
    `it should support the 'paths' option from require.resolve (same dependency tree)`,
    makeTemporaryEnv(
      {
        private: true,
        workspaces: [`workspace-*`],
      },
      {
        nodeLinker: `pnpm`,
      },
      async ({path, run, source}) => {
        await writeJson(`${path}/workspace-a/package.json`, {
          name: `workspace-a`,
          version: `1.0.0`,
          dependencies: {[`no-deps`]: `1.0.0`},
        });

        await writeJson(`${path}/workspace-b/package.json`, {
          name: `workspace-b`,
          version: `1.0.0`,
          dependencies: {[`no-deps`]: `2.0.0`, [`one-fixed-dep`]: `1.0.0`},
        });

        await run(`install`);

        await expect(
          source(
            `require(require.resolve('no-deps', {paths: ${JSON.stringify([
              `${npath.fromPortablePath(path)}/workspace-a`,
              `${npath.fromPortablePath(path)}/workspace-b`,
            ])}}))`,
          ),
        ).resolves.toMatchObject({
          name: `no-deps`,
          version: `1.0.0`,
        });
      },
    ),
  );

  test(
    `it should support the 'paths' option from require.resolve (different dependency trees)`,
    makeTemporaryEnv(
      {
        dependencies: {},
      },
      {
        nodeLinker: `pnpm`,
      },
      async ({path, run, source}) => {
        await run(`install`);

        const tmpA = await xfs.mktempPromise();
        const tmpB = await xfs.mktempPromise();

        await writeJson(`${tmpA}/package.json`, {
          dependencies: {[`no-deps`]: `1.0.0`},
        });

        await writeJson(`${tmpB}/package.json`, {
          dependencies: {[`no-deps`]: `2.0.0`, [`one-fixed-dep`]: `1.0.0`},
        });

        await run(`install`, {
          cwd: tmpA,
        });

        await run(`install`, {
          cwd: tmpB,
        });

        await expect(
          source(`require(require.resolve('no-deps', {paths: ${JSON.stringify([tmpA, tmpB])}}))`),
        ).resolves.toMatchObject({
          name: `no-deps`,
          version: `1.0.0`,
        });
      },
    ),
  );

  test(
    `it should be able to require files from a different dependency tree`,
    makeTemporaryEnv(
      {
        dependencies: {
          [`no-deps`]: `1.0.0`,
        },
      },
      {
        nodeLinker: `pnpm`,
      },
      async ({path, run, source}) => {
        await run(`install`);

        const tmp = await xfs.mktempPromise();

        await xfs.writeJsonPromise(ppath.join(tmp, `package.json`), {
          dependencies: {
            [`no-deps`]: `2.0.0`,
          },
        });

        await xfs.writeFilePromise(ppath.join(tmp, `index.js`), `
          module.exports = require('no-deps');
        `);

        await run(`install`, {cwd: tmp});

        await expect(source(`require('no-deps')`)).resolves.toEqual({
          name: `no-deps`,
          version: `1.0.0`,
        });

        await expect(source(`require(${JSON.stringify(tmp)})`)).resolves.toEqual({
          name: `no-deps`,
          version: `2.0.0`,
        });
      }),
  );

  test(
    `it should allow scripts outside of the dependency tree to require files within the dependency tree`,
    makeTemporaryEnv(
      {dependencies: {[`no-deps`]: `1.0.0`}},
      {
        nodeLinker: `pnpm`,
      },
      async ({path, run, source}) => {
        await run(`install`);

        const tmp = await xfs.mktempPromise();

        await writeFile(`${tmp}/first.js`, `require(process.argv[2])`);
        await writeFile(`${path}/second.js`, `require('no-deps')`);

        await run(`node`, `${npath.fromPortablePath(tmp)}/first.js`, `${npath.fromPortablePath(path)}/second.js`);
      },
    ),
  );

  test(
    `it should install the packages within a hashed directory under node_modules/.store`,
    makeTemporaryEnv(
      {
        dependencies: {
          [`no-deps`]: `1.0.0`,
        },
      },
      {
        nodeLinker: `pnpm`,
      },
      async ({path, run, source}) => {
        await run(`install`);

        expect(await source(`require.resolve('no-deps')`)).toMatch(/[\\/]node_modules[\\/]\.store[\\/]no-deps-npm-1\.0\.0-[a-f0-9]{10}[\\/]no-deps[\\/]/);
      },
    ),
  );

  test(
    `it should install packages with peer dependencies within a hashed directory under node_modules/.store`,
    makeTemporaryEnv(
      {
        dependencies: {
          [`peer-deps`]: `1.0.0`,
          [`no-deps`]: `2.0.0`,
        },
      },
      {
        nodeLinker: `pnpm`,
      },
      async ({path, run, source}) => {
        await run(`install`);

        expect(await source(`require.resolve('peer-deps')`)).toMatch(/[\\/]node_modules[\\/]\.store[\\/]peer-deps-virtual-[a-f0-9]{10}[\\/]peer-deps[\\/]/);
      },
    ),
  );


  test(
    `it should not cache the postinstall artifacts`,
    makeTemporaryEnv(
      {
        dependencies: {[`no-deps-scripted`]: `1.0.0`},
      },
      {
        nodeLinker: `pnpm`,
      },
      async ({path, run, source}) => {
        await run(`install`);

        const rndBefore = await source(`require('no-deps-scripted/rnd.js')`);

        await xfs.removePromise(`${path}/.yarn`);

        await run(`install`);

        const rndAfter = await source(`require('no-deps-scripted/rnd.js')`);

        // It might fail once every blue moon, when the two random numbers are equal
        expect(rndAfter).not.toEqual(rndBefore);
      },
    ),
  );

  test(
    `it should not break spawning new Node processes ('node' command)`,
    makeTemporaryEnv(
      {
        dependencies: {[`no-deps`]: `1.0.0`},
      },
      {
        nodeLinker: `pnpm`,
      },
      async ({path, run, source}) => {
        await run(`install`);

        await writeFile(`${path}/script.js`, `console.log(JSON.stringify(require('no-deps')))`);

        await expect(
          source(
            `JSON.parse(require('child_process').execFileSync(process.execPath, [${JSON.stringify(
              `${npath.fromPortablePath(path)}/script.js`,
            )}]).toString())`,
          ),
        ).resolves.toMatchObject({
          name: `no-deps`,
          version: `1.0.0`,
        });
      },
    ),
  );

  test(
    `it should not break spawning new Node processes ('run' command)`,
    makeTemporaryEnv(
      {
        dependencies: {[`no-deps`]: `1.0.0`},
        scripts: {[`script`]: `node main.js`},
      },
      {
        nodeLinker: `pnpm`,
      },
      async ({path, run, source}) => {
        await run(`install`);

        await writeFile(`${path}/sub.js`, `console.log(JSON.stringify(require('no-deps')))`);
        await writeFile(
          `${path}/main.js`,
          `console.log(require('child_process').execFileSync(process.execPath, [${JSON.stringify(
            `${npath.fromPortablePath(path)}/sub.js`,
          )}]).toString())`,
        );

        expect(JSON.parse((await run(`run`, `script`)).stdout)).toMatchObject({
          name: `no-deps`,
          version: `1.0.0`,
        });
      },
    ),
  );

  test(
    `it should properly forward the NODE_OPTIONS environment variable`,
    makeTemporaryEnv(
      {},
      {
        nodeLinker: `pnpm`,
      },
      async ({path, run, source}) => {
        await run(`install`);

        await writeFile(`${path}/foo.js`, `console.log(42);`);

        await expect(
          run(`node`, `-e`, `console.log(21);`, {env: {NODE_OPTIONS: `--require ${JSON.stringify(npath.join(npath.fromPortablePath(path), `foo`))}`}}),
        ).resolves.toMatchObject({
        // Note that '42' is present twice: the first one because Node executes Yarn, and the second one because Yarn spawns Node
          stdout: `42\n42\n21\n`,
        });
      }),
  );

  test(
    `it should allow external modules to require internal ones`,
    makeTemporaryEnv({
      dependencies: {
        [`no-deps`]: `1.0.0`,
      },
    },
    {
      nodeLinker: `pnpm`,
    },
    async ({path, run, source}) => {
      await xfs.mktempPromise(async temp => {
        await run(`install`);

        await writeFile(`${temp}/foo.js`, `
          const resolved = require.resolve(process.argv[2], {paths: [process.argv[3]]});
          const required = require(resolved);

          console.log(required);
        `);

        await run(`node`, `${npath.fromPortablePath(temp)}/foo.js`, `no-deps`, `${npath.fromPortablePath(path)}/`);
      });
    }),
  );

  test(
    `it should remove the lingering node_modules folders`,
    makeTemporaryEnv(
      {},
      {
        nodeLinker: `pnpm`,
      },
      async ({path, run, source}) => {
        await xfs.mkdirpPromise(`${path}/node_modules/foo`);

        await run(`install`);

        await expect(xfs.readdirPromise(path)).resolves.not.toContain(`node_modules`);
      }),
  );

  test(
    `it shouldn't remove the lingering node_modules folders when they contain dot-folders`,
    makeTemporaryEnv(
      {},
      {
        nodeLinker: `pnpm`,
      },
      async ({path, run, source}) => {
        await xfs.mkdirpPromise(`${path}/node_modules/.cache`);

        await run(`install`);

        await expect(xfs.readdirPromise(path)).resolves.toContain(`node_modules`);
        await expect(xfs.readdirPromise(ppath.join(path, `node_modules`))).resolves.toEqual([
          `.cache`,
        ]);
      }),
  );

  test(
    `it should remove lingering folders from the node_modules even when they contain dot-folders`,
    makeTemporaryEnv(
      {},
      {
        nodeLinker: `pnpm`,
      },
      async ({path, run, source}) => {
        await xfs.mkdirpPromise(`${path}/node_modules/.cache`);
        await xfs.mkdirpPromise(`${path}/node_modules/foo`);
        await xfs.mkdirpPromise(`${path}/node_modules/bar/.bin`);

        await run(`install`);

        await expect(xfs.readdirPromise(path)).resolves.toContain(`node_modules`);
        await expect(xfs.readdirPromise(ppath.join(path, `node_modules`))).resolves.toEqual([
          `.cache`,
        ]);
      }),
  );

  test(
    `it shouldn't break the vscode builtin resolution`,
    makeTemporaryEnv(
      {},
      {
        nodeLinker: `pnpm`,
      },
      async ({path, run, source}) => {
      // VSCode has its own layer on top of `require` to provide extra builtins
      // to the plugins. We don't want to accidentally break this:
      //
      // https://github.com/microsoft/vscode/blob/dcecb9eea6158f561ee703cbcace49b84048e6e3/src/vs/workbench/api/node/extHostExtensionService.ts#L23

        await run(`install`);

        const tmp = await xfs.mktempPromise();
        await xfs.writeFilePromise(ppath.join(tmp, `index.js`), `
        const realLoad = module.constructor._load;

        module.constructor._load = function (name, ...args) {
          if (name === 'foo') {
            return 'this works';
          } else {
            return realLoad.call(this, name, ...args);
          }
        };

        if (require('foo') !== 'this works') {
          throw new Error('Assertion failed');
        }
      `);

        cp.execFileSync(`node`, [
          npath.fromPortablePath(`${tmp}/index.js`),
        ], {encoding: `utf-8`});
      }),
  );

  test(`should skip building incompatible package`,
    makeTemporaryEnv(
      {
        private: true,
        dependencies: {
          dep: `file:./dep`,
        },
      },
      {
        nodeLinker: `pnpm`,
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
        await writeFile(`${path}/dep/index.js`, `module.exports = require('./package.json');`);

        const stdout = (await run(`install`)).stdout;

        expect(stdout).not.toContain(`Shall not be run`);
        expect(stdout).toMatch(new RegExp(`dep@file:./dep.*The ${process.platform}-${process.arch}(-[a-z]+)? architecture is incompatible with this package, build skipped.`));

        await expect(source(`require('dep')`)).resolves.toMatchObject({
          name: `dep`,
          version: `1.0.0`,
        });
      },
    ),
  );

  test(
    `it should work when working inside a sandbox environment full of symlinks`,
    makeTemporaryEnv(
      {
        dependencies: {
          [`no-deps`]: `1.0.0`,
        },
      },
      {
        nodeLinker: `pnpm`,
      },
      async ({path, run, source}) => {
        await run(`install`);

        await writeFile(ppath.join(path, `file.js`), `
        console.log(require.resolve('no-deps'));
      `);

        const testSandboxPath = ppath.resolve(ppath.join(path, `..`, `test-sandbox-out`));
        await xfs.mkdirpPromise(testSandboxPath);

        await Promise.all([
          xfs.symlinkPromise(ppath.join(path, `.yarn`), ppath.join(testSandboxPath, `.yarn`)),
          xfs.symlinkPromise(ppath.join(path, Filename.lockfile), ppath.join(testSandboxPath, Filename.lockfile)),
          xfs.symlinkPromise(ppath.join(path, Filename.manifest), ppath.join(testSandboxPath, Filename.manifest)),
          xfs.symlinkPromise(ppath.join(path, Filename.pnpCjs), ppath.join(testSandboxPath, Filename.pnpCjs)),
          xfs.symlinkPromise(ppath.join(path, Filename.pnpData), ppath.join(testSandboxPath, Filename.pnpData)),
          xfs.symlinkPromise(ppath.join(path, `file.js`), ppath.join(testSandboxPath, `file.js`)),
        ]);

        await run(`node`, `file.js`, {
          projectFolder: testSandboxPath,
        });
      }),
  );

  test(
    `it should take trailing slashes into account when resolving paths`,
    makeTemporaryEnv(
      {},
      {
        nodeLinker: `pnpm`,
      },
      async ({path, run, source}) => {
        await writeFile(`${path}/foo.js`, ``);

        await xfs.mkdirPromise(`${path}/foo`);
        await writeFile(`${path}/foo/index.js`, ``);

        await run(`install`);

        await expect(source(`require.resolve('./foo')`)).resolves.toEqual(npath.fromPortablePath(`${path}/foo.js`));
        await expect(source(`require.resolve('./foo/')`)).resolves.toEqual(npath.fromPortablePath(`${path}/foo/index.js`));
      }),
  );

  test(
    `it should be able to resolve a dependency using a module instance without an id`,
    makeTemporaryEnv(
      {
        workspaces: [`workspace-a`],
      },
      {
        nodeLinker: `pnpm`,
      },
      async ({path, run, source}) => {
        await xfs.mkdirpPromise(`${path}/workspace-a`);
        await xfs.writeJsonPromise(`${path}/workspace-a/package.json`, {dependencies: {[`no-deps`]: `*`}});
        await xfs.writeFilePromise(`${path}/index.js`, `
        const Module = require('module');
        const path = require('path');

        module.exports = Module._resolveFilename(
          'no-deps',
          Object.assign(new Module(), {
            paths: Module._nodeModulePaths(path.join(__dirname, 'workspace-a')),
          })
        );
        `);

        await run(`install`);

        await expect(source(`require('./index.js')`)).resolves.toMatch(/no-deps(\\|\/)index.js/);
      }),
  );

  test(
    `it should set bytesRead on Windows when input is a pipe and EOF is thrown`,
    makeTemporaryEnv(
      {},
      {
        nodeLinker: `pnpm`,
      },
      async ({path, run, source}) => {
        await run(`install`);

        await xfs.writeFilePromise(`${path}/index.js`, `
        const fs = require('fs');

        module.exports = new Promise(resolve => {
          fs.read(0, Buffer.alloc(10000), 0, 10000, null, (err, bytesRead1, buffer) => {
            fs.read(0, Buffer.alloc(10000), 0, 10000, null, (err, bytesRead2, buffer) => {
              resolve([bytesRead1, bytesRead2]);
            });
          });
        });
      `);

        await expect(source(`require('./index.js')`, {
          stdin: `\n`,
        })).resolves.toEqual([1, 0]);
      }),
  );

  test(
    `it should pick the most specific locator`,
    makeTemporaryEnv(
      { },
      {
        nodeLinker: `pnpm`,
      },
      async ({path, run, source}) => {
        await xfs.mkdirPromise(`${path}/sub-project`);
        await xfs.writeJsonPromise(`${path}/sub-project/package.json`, {
          dependencies: {
            'no-deps': `1.0.0`,
          },
        });
        await xfs.writeFilePromise(`${path}/sub-project/yarn.lock`, ``);

        await expect(run(`install`, {cwd: `${path}/sub-project`})).resolves.toMatchObject({code: 0});
        await run(`install`);

        await xfs.writeFilePromise(`${path}/sub-project/index.js`, `
          const path = require('path');
          require.resolve('no-deps', {paths: [path.resolve(__dirname, '..'), __filename]});
          require.resolve('no-deps', {paths: [path.resolve(__dirname, '..'), __filename]});
        `);

        await expect(run(`node`, `./index.js`, {cwd: `${path}/sub-project`})).resolves.toMatchObject({code: 0});
      },
    ),
  );

  test(
    `it should load modules that haven't been loaded`,
    makeTemporaryEnv(
      { },
      {
        nodeLinker: `pnpm`,
      },
      async ({path, run, source}) => {
        await run(`install`);

        await xfs.writeFilePromise(`${path}/foo.js`, `
          module.exports.foo = 42;
        `);

        await xfs.writeFilePromise(`${path}/index.js`, `
          import('./foo.js').then((mod) => console.log(mod.foo));
        `);

        await expect(run(`node`, `./index.js`)).resolves.toMatchObject({
          code: 0,
          stdout: `42\n`,
        });
      },
    ),
  );

  test(
    `it should support circular requires`,
    makeTemporaryEnv(
      { },
      {
        nodeLinker: `pnpm`,
      },
      async ({path, run, source}) => {
        await run(`install`);

        await xfs.writeFilePromise(`${path}/foo.js`, `
          module.exports.foo = 42;
          require('./index.js');
        `);

        await xfs.writeFilePromise(`${path}/index.js`, `
          console.log(require('./foo.js').foo);
        `);

        await expect(run(`node`, `./index.js`)).resolves.toMatchObject({
          code: 0,
          stdout: `42\n`,
        });
      },
    ),
  );

  test(
    `it should respect user provided conditions`,
    makeTemporaryEnv(
      {
        imports: {
          '#foo': {
            custom: `./custom.js`,
            default: `./404.js`,
          },
        },
      },
      {
        nodeLinker: `pnpm`,
      },
      async ({path, run, source}) => {
        await run(`install`);

        await xfs.writeFilePromise(ppath.join(path, `custom.js`), `console.log('foo')`);
        await xfs.writeFilePromise(ppath.join(path, `index.js`), `require('#foo')`);

        await expect(run(`node`, `--conditions`, `custom`, `./index.js`)).resolves.toMatchObject({
          code: 0,
          stdout: `foo\n`,
          stderr: ``,
        });

        await expect(run(`node`, `-C`, `custom`, `./index.js`)).resolves.toMatchObject({
          code: 0,
          stdout: `foo\n`,
          stderr: ``,
        });

        await expect(
          run(`node`, `./index.js`, {
            env: {
              NODE_OPTIONS: `--conditions custom`,
            },
          }),
        ).resolves.toMatchObject({
          code: 0,
          stdout: `foo\n`,
          stderr: ``,
        });

        await expect(
          run(`node`, `./index.js`, {
            env: {
              NODE_OPTIONS: `-C custom`,
            },
          }),
        ).resolves.toMatchObject({
          code: 0,
          stdout: `foo\n`,
          stderr: ``,
        });
      },
    ),
  );

  test(
    `it should emit a warning for circular dependency exports access`,
    makeTemporaryEnv(
      {},
      {
        nodeLinker: `pnpm`,
      },
      async ({path, run, source}) => {
        await run(`install`);

        await xfs.writeFilePromise(ppath.join(path, `a.js`), `require('./b.js');`);
        await xfs.writeFilePromise(ppath.join(path, `b.js`), `require('./a.js').foo;`);

        await expect(run(`node`, `./a.js`)).resolves.toMatchObject({
          code: 0,
          stdout: ``,
          stderr: expect.stringContaining(`of module exports inside circular dependency`),
        });
      }),
  );
});
