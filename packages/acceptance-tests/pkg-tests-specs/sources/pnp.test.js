const {npath, ppath, xfs} = require(`@yarnpkg/fslib`);
const cp = require(`child_process`);
const {satisfies} = require(`semver`);

const {
  fs: {createTemporaryFolder, readFile, writeFile, writeJson},
  tests: {getPackageDirectoryPath, testIf},
} = require(`pkg-tests-core`);

describe(`Plug'n'Play`, () => {
  test(
    `it should not touch the .pnp.js file when it already exists and is up-to-date`,
    makeTemporaryEnv(
      {},
      async ({path, run, source}) => {
        await run(`install`);

        const beforeTime = (await xfs.statPromise(`${path}/.pnp.js`)).mtimeMs;

        // Need to wait two seconds to be sure that the mtime will change
        await new Promise(resolve => setTimeout(resolve, 2000));

        await run(`install`);

        const afterTime = (await xfs.statPromise(`${path}/.pnp.js`)).mtimeMs;

        expect(afterTime).toEqual(beforeTime);
      },
    ),
  );

  test(
    `it should update the .pnp.js file when it already exists but isn't up-to-date`,
    makeTemporaryEnv(
      {},
      async ({path, run, source}) => {
        await run(`install`);

        const beforeTime = (await xfs.statPromise(`${path}/.pnp.js`)).mtimeMs;

        await writeJson(`${path}/package.json`, {
          dependencies: {
            [`no-deps`]: `1.0.0`,
          },
        });

        // Need to wait two seconds to be sure that the mtime will change
        await new Promise(resolve => setTimeout(resolve, 2000));

        await run(`install`);

        const afterTime = (await xfs.statPromise(`${path}/.pnp.js`)).mtimeMs;

        expect(afterTime).not.toEqual(beforeTime);
      },
    ),
  );

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
    `it should correctly resolve an absolute path even when the issuer doesn't exist`,
    makeTemporaryEnv({}, async ({path, run, source}) => {
      await run(`install`);

      const api = require(`${path}/.pnp.js`);
      api.resolveToUnqualified(`${path}/.pnp.js`, `${path}/some/path/that/doesnt/exists/please/`);
    }),
  );

  test(
    `it should fallback to the top-level dependencies when it cannot require a transitive dependency require`,
    makeTemporaryEnv(
      {
        dependencies: {[`various-requires`]: `1.0.0`, [`no-deps`]: `1.0.0`},
      },
      {
        // By default tests are executed with the fallback disabled; this
        // setting forces this test to execute in the default mode instead
        pnpFallbackMode: undefined,
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
    `it should not fallback workspaces by default to the top-level dependencies when they require an undeclared package`,
    makeTemporaryEnv(
      {
        private: true,
        workspaces: [`packages/*`],
        dependencies: {[`no-deps`]: `1.0.0`},
      },
      {
        // By default tests are executed with the fallback disabled; this
        // setting forces this test to execute in the default mode instead
        pnpFallbackMode: undefined,
      },
      async ({path, run, source}) => {
        await writeJson(`${path}/packages/workspace-a/package.json`, {
          name: `workspace-a`,
          version: `1.0.0`,
        });

        await writeFile(
          `${path}/packages/workspace-a/index.js`,
          `module.exports = require('no-deps');`,
        );

        await run(`install`);

        await expect(source(`require('workspace-a')`)).rejects.toBeTruthy();
      },
    ),
  );

  test(
    `it should fallback workspaces to the top-level dependencies when they require an undeclared package and the fallback mode is 'all'`,
    makeTemporaryEnv(
      {
        private: true,
        workspaces: [`packages/*`],
        dependencies: {
          [`workspace-a`]: `1.0.0`,
          [`no-deps`]: `1.0.0`,
        },
      },
      {
        pnpFallbackMode: `all`,
      },
      async ({path, run, source}) => {
        await writeJson(`${path}/packages/workspace-a/package.json`, {
          name: `workspace-a`,
          version: `1.0.0`,
        });

        await writeFile(
          `${path}/packages/workspace-a/index.js`,
          `module.exports = require('no-deps');`,
        );

        await run(`install`);

        await expect(source(`require('workspace-a')`)).resolves.toMatchObject({
          name: `no-deps`,
          version: `1.0.0`,
        });
      },
    ),
  );

  test(
    `it should throw an exception if a dependency tries to require something it doesn't own`,
    makeTemporaryEnv(
      {dependencies: {[`various-requires`]: `1.0.0`}},
      async ({path, run, source}) => {
        await run(`install`);

        await expect(source(`require('various-requires/invalid-require')`)).rejects.toMatchObject({
          externalException: {
            code: `MODULE_NOT_FOUND`,
            pnpCode: `UNDECLARED_DEPENDENCY`,
          },
        });
      },
    ),
  );

  test(
    `it should throw different semantic errors based on whether the project or a sub-dependency requires something it doesn't own`,
    makeTemporaryEnv(
      {
        dependencies: {[`various-requires`]: `1.0.0`},
      },
      async ({path, run, source}) => {
        await run(`install`);

        const rootMessage = await source(`{ try { require('no-deps') } catch (error) { return error.message } }`);
        const dependencyMessage = await source(`{ try { require('various-requires/invalid-require') } catch (error) { return error.message } }`);

        const filter = message => message.replace(/^(-|[^:]*:) .*/gm, `$1 Something`);

        expect(filter(rootMessage)).not.toEqual(filter(dependencyMessage));
      },
    )
  );

  test(
    `it should throw the same error than the root when a workspace requires something it doesn't own`,
    makeTemporaryEnv(
      {
        private: true,
        workspaces: [`packages/*`],
      },
      async ({path, run, source}) => {
        const workspacePath = ppath.join(path, `packages/workspace-a`);

        await xfs.mkdirpPromise(workspacePath);
        await xfs.writeJsonPromise(ppath.join(workspacePath, `package.json`), {name: `workspace-a`});

        await run(`install`);

        const code = `{ try { require('no-deps') } catch (error) { return error.message } }`;

        const rootMessage = await source(code);
        const workspaceMessage = await source(code, {cwd: ppath.join(workspacePath)});

        const filter = message => message.replace(/^(-|[^:]*:) .*/gm, `$1 Something`);

        expect(filter(workspaceMessage)).toEqual(filter(rootMessage));
      },
    )
  );

  test(
    `it should throw an exception if a dependency tries to require a missing peer dependency`,
    makeTemporaryEnv(
      {dependencies: {[`peer-deps`]: `1.0.0`}},
      async ({path, run, source}) => {
        await run(`install`);

        await expect(source(`require('peer-deps')`)).rejects.toMatchObject({
          externalException: {
            code: `MODULE_NOT_FOUND`,
            pnpCode: `MISSING_PEER_DEPENDENCY`,
          },
        });
      },
    ),
  );

  test(
    `it should mention which ancestor broke the peer dependency chain`,
    makeTemporaryEnv(
      {dependencies: {[`broken-peer-deps`]: `1.0.0`}},
      async ({path, run, source}) => {
        await run(`install`);

        await expect(source(`require('broken-peer-deps')`)).rejects.toMatchObject({
          externalException: {
            message: expect.stringContaining(`Ancestor breaking the chain: broken-peer-deps@npm:1.0.0`),
            code: `MODULE_NOT_FOUND`,
            pnpCode: `MISSING_PEER_DEPENDENCY`,
          },
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
      async ({path, run, source}) => {
        await run(`install`);

        await expect(source(`require('various-requires/self') === require('various-requires')`)).resolves.toEqual(true);
      },
    ),
  );

  test(
    `it should not add the implicit self dependency if an explicit one already exists`,
    makeTemporaryEnv(
      {
        dependencies: {[`self-require-trap`]: `1.0.0`},
      },
      async ({path, run, source}) => {
        await run(`install`);

        await expect(source(`require('self-require-trap/self') !== require('self-require-trap')`)).resolves.toEqual(
          true,
        );
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
      async ({path, run, source}) => {
        const {stdout} = await run(`install`);
        expect(stdout).not.toEqual(expect.stringContaining(`YN0060`));
      }
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

  testIf(
    () => satisfies(process.versions.node, `>=8.9.0`),
    `it should support the 'paths' option from require.resolve (same dependency tree)`,
    makeTemporaryEnv(
      {
        private: true,
        workspaces: [`workspace-*`],
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

  testIf(
    () => satisfies(process.versions.node, `>=8.9.0`),
    `it should terminate when the 'paths' option from require.resolve includes empty string and there is no .pnp.js in the working dir`,
    makeTemporaryEnv(
      {
        private: true,
        workspaces: [`workspace-*`],
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
              ``,
            ])}}))`,
            {cwd: `${path}/workspace-a`}
          ),
        ).resolves.toMatchObject({
          name: `no-deps`,
          version: `1.0.0`,
        });
      },
    ),
  );

  // Skipped because not supported (we can't require files from within other dependency trees, since we couldn't
  // reconcile them together: dependency tree A could think that package X has deps Y@1 while dependency tree B
  // could think that X has deps Y@2 instead. Since they would share the same location on the disk, PnP wouldn't
  // be able to tell which one should be used)
  test.skip(
    `it should support the 'paths' option from require.resolve (different dependency trees)`,
    makeTemporaryEnv(
      {
        dependencies: {},
      },
      async ({path, run, source}) => {
        await run(`install`);

        const tmpA = await createTemporaryFolder();
        const tmpB = await createTemporaryFolder();

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
    makeTemporaryEnv({
      dependencies: {
        [`no-deps`]: `1.0.0`,
      },
    }, async ({path, run, source}) => {
      await run(`install`);

      const tmp = await createTemporaryFolder();

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

  testIf(
    () => satisfies(process.versions.node, `>=8.9.0`),
    `it should throw when using require.resolve with unsupported options`,
    makeTemporaryEnv(
      {
        dependencies: {[`no-deps`]: `1.0.0`},
      },
      async ({path, run, source}) => {
        await run(`install`);

        await expect(source(`require.resolve('no-deps', {foobar: 42})`)).rejects.toBeTruthy();
      },
    ),
  );

  test(
    `it should use the regular Node resolution when requiring files outside of the pnp install tree`,
    makeTemporaryEnv({}, async ({path, run, source}) => {
      await run(`install`);

      const tmp = await createTemporaryFolder();

      await writeFile(`${tmp}/node_modules/dep/index.js`, `module.exports = 42;`);
      await writeFile(`${tmp}/index.js`, `require('dep')`);

      await source(`require(${JSON.stringify(tmp)} + "/index.js")`);
    }),
  );

  test(
    `it should allow scripts outside of the dependency tree to require files within the dependency tree`,
    makeTemporaryEnv(
      {dependencies: {[`no-deps`]: `1.0.0`}},
      async ({path, run, source}) => {
        await run(`install`);

        const tmp = await createTemporaryFolder();

        await writeFile(`${tmp}/index.js`, `require(process.argv[2])`);
        await writeFile(`${path}/index.js`, `require('no-deps')`);

        await run(`node`, `${npath.fromPortablePath(tmp)}/index.js`, `${npath.fromPortablePath(path)}/index.js`);
      },
    ),
  );

  test(
    `it should allow ignored paths to require files within the dependency tree`,
    makeTemporaryEnv(
      {dependencies: {[`no-deps`]: `1.0.0`}},
      async ({path, run, source}) => {
        await run(`install`);

        const tmp = await createTemporaryFolder();

        await writeFile(`${tmp}/index.js`, `require(process.argv[2])`);
        await writeFile(`${path}/index.js`, `require('no-deps')`);

        await run(`node`, `${npath.fromPortablePath(tmp)}/index.js`, `${npath.fromPortablePath(path)}/index.js`);
      },
    ),
  );

  test(
    `it should export the PnP API through the 'pnpapi' name`,
    makeTemporaryEnv(
      {},
      async ({path, run, source}) => {
        await run(`install`);

        await expect(source(`typeof require('pnpapi').VERSIONS.std`)).resolves.toEqual(`number`);
      },
    ),
  );

  test(
    `it should return the path to the PnP file when calling require.resolve('pnpapi')`,
    makeTemporaryEnv(
      {},
      async ({path, run, source}) => {
        await run(`install`);

        await expect(xfs.existsSync(await source(`require.resolve('pnpapi')`))).toEqual(true);
      },
    ),
  );

  test(
    `it should expose the PnP version through 'process.versions.pnp'`,
    makeTemporaryEnv({}, async ({path, run, source}) => {
      await run(`install`);

      const pnpapiVersionsStd = await source(`require('pnpapi').VERSIONS.std`);
      const processVersionsPnp = await source(`process.versions.pnp`);

      await expect(typeof processVersionsPnp).toEqual(`string`);
      await expect(processVersionsPnp).toEqual(String(pnpapiVersionsStd));
    }),
  );

  test(
    `it should expose 'findPnpApi' in the 'module' builtin`,
    makeTemporaryEnv({}, async ({path, run, source}) => {
      await run(`install`);

      await expect(source(`require('module').findPnpApi(process.cwd()) === require('pnpapi')`)).resolves.toEqual(true);
    }),
  );

  testIf(
    () => process.platform !== `win32`,
    `it should generate a file that can be used as an executable to resolve a request (valid request)`,
    makeTemporaryEnv(
      {
        dependencies: {
          [`no-deps`]: `1.0.0`,
        },
      },
      async ({path, run, source}) => {
        await run(`install`);

        expect((await xfs.statPromise(`${path}/.pnp.js`)).mode & 0o111).toEqual(0o111);

        const result = JSON.parse(cp.execFileSync(`${path}/.pnp.js`, [`no-deps`, `${path}/`], {encoding: `utf-8`}));

        expect(result[0]).toEqual(null);
        expect(typeof result[1]).toEqual(`string`);

        expect(require(result[1])).toMatchObject({
          name: `no-deps`,
          version: `1.0.0`,
        });
      },
    ),
  );

  testIf(
    () => process.platform !== `win32`,
    `it should generate a file that can be used as an executable to resolve a request (builtin request)`,
    makeTemporaryEnv(
      {
        dependencies: {
          [`no-deps`]: `1.0.0`,
        },
      },
      async ({path, run, source}) => {
        await run(`install`);

        expect((await xfs.statPromise(`${path}/.pnp.js`)).mode & 0o111).toEqual(0o111);

        const result = JSON.parse(cp.execFileSync(`${path}/.pnp.js`, [`fs`, `${path}/`], {encoding: `utf-8`}));

        expect(result[0]).toEqual(null);
        expect(result[1]).toEqual(null);
      },
    ),
  );

  testIf(
    () => process.platform !== `win32`,
    `it should generate a file that can be used as an executable to resolve a request (invalid request)`,
    makeTemporaryEnv(
      {
        dependencies: {
          [`no-deps`]: `1.0.0`,
        },
      },
      async ({path, run, source}) => {
        await run(`install`);

        expect((await xfs.statPromise(`${path}/.pnp.js`)).mode & 0o111).toEqual(0o111);

        const result = JSON.parse(
          cp.execFileSync(`${path}/.pnp.js`, [`doesnt-exists`, `${path}/`], {encoding: `utf-8`}),
        );

        expect(typeof result[0].code).toEqual(`string`);
        expect(typeof result[0].message).toEqual(`string`);

        expect(result[1]).toEqual(null);
      },
    ),
  );

  test(
    `it should generate a file with a custom shebang if configured as such`,
    makeTemporaryEnv(
      {},
      {
        pnpShebang: `#!foo`,
      },
      async ({path, run, source}) => {
        await run(`install`);

        const pnpJs = await readFile(`${path}/.pnp.js`, `utf8`);

        expect(pnpJs.replace(/(\r\n|\r|\n).*/s, ``)).toMatch(/^#!foo$/);
      },
    ),
  );

  test(
    `it should not be enabled for paths matching the specified regex`,
    makeTemporaryEnv(
      {},
      {
        pnpIgnorePatterns: `foo/**`,
      },
      async ({path, run, source}) => {
        await writeFile(`${path}/foo/shouldwork.js`, `module.exports = require('bad-dep');\n`);
        await writeFile(`${path}/doesntwork.js`, `module.exports = require('bad-dep');\n`);

        await run(`install`);

        // Force it to exist so that the two scripts would succeed if using the node resolution
        await writeFile(`${path}/node_modules/bad-dep/index.js`, `module.exports = 42;\n`);

        await expect(source(`require('./doesntwork')`)).rejects.toBeTruthy();
        await expect(source(`require('./foo/shouldwork')`)).resolves.toBeTruthy();
      },
    ),
  );

  test(
    `it should not break relative requires for files within a blacklist`,
    makeTemporaryEnv(
      {},
      {
        pnpIgnorePatterns: `foo/**`,
      },
      async ({path, run, source}) => {
        await writeFile(`${path}/foo/filea.js`, `module.exports = require('./fileb');\n`);
        await writeFile(`${path}/foo/fileb.js`, `module.exports = 42;\n`);

        await run(`install`);

        await expect(source(`require('./foo/filea')`)).resolves.toEqual(42);
      },
    ),
  );

  test(
    `it should install the packages within a node_modules directory (even if within the cache)`,
    makeTemporaryEnv(
      {
        dependencies: {
          [`no-deps`]: `1.0.0`,
        },
      },
      async ({path, run, source}) => {
        // This is to allow a maximal compatibility with packages that expect to
        // be located inside a node_modules directory. Various tools (such as
        // transpilers) also use regexps in their configuration that it would be
        // nice not to break.

        await run(`install`);

        expect(await source(`require.resolve('no-deps')`)).toMatch(/[\\/]node_modules[\\/]no-deps[\\/]/);
      },
    ),
  );

  test(
    `it should install packages with peer dependencies within a node_modules directory (even if within the .pnp folder)`,
    makeTemporaryEnv(
      {
        dependencies: {
          [`peer-deps`]: `1.0.0`,
          [`no-deps`]: `2.0.0`,
        },
      },
      async ({path, run, source}) => {
        // This is to allow a maximal compatibility with packages that expect to
        // be located inside a node_modules directory. Various tools (such as
        // transpilers) also use regexps in their configuration that it would be
        // nice not to break.

        await run(`install`);

        expect(await source(`require.resolve('peer-deps')`)).toMatch(/[\\/]node_modules[\\/]peer-deps[\\/]/);
      },
    ),
  );

  test(
    `it should make it possible to copy the pnp file and cache from one place to another`,
    makeTemporaryEnv(
      {
        dependencies: {
          [`no-deps`]: `1.0.0`,
        },
      },
      async ({path, run, source}) => {
        await run(`install`);

        await makeTemporaryEnv(
          {
            [`no-deps`]: `1.0.0`,
          },
          async ({path: path2, run: run2, source: source2}) => {
            // Move the install artifacts into a new location
            // If the .pnp.js file references absolute paths, they will stop working
            await xfs.renamePromise(`${path}/.yarn`, `${path2}/.yarn`);
            await xfs.renamePromise(`${path}/.pnp.js`, `${path2}/.pnp.js`);

            await expect(source2(`require('no-deps')`)).resolves.toMatchObject({
              name: `no-deps`,
              version: `1.0.0`,
            });
          },
        )();
      },
    ),
  );

  test(
    `it should generate the same hooks for two projects with the same configuration`,
    makeTemporaryEnv(
      {
        dependencies: {
          [`no-deps`]: `1.0.0`,
        },
      },
      async ({path, run, source}) => {
        await run(`install`);

        await makeTemporaryEnv(
          {
            dependencies: {
              [`no-deps`]: `1.0.0`,
            },
          },
          async ({path: path2, run: run2, source: source2}) => {
            expect(path2).not.toEqual(path);

            await run2(`install`);

            expect(readFile(`${path2}/.pnp.js`, `utf8`)).resolves.toEqual(await readFile(`${path}/.pnp.js`, `utf8`));
          },
        )();
      },
    ),
  );

  test(
    `it should allow unplugging a simple package from a pnp installation`,
    makeTemporaryEnv(
      {
        dependencies: {
          [`no-deps`]: `1.0.0`,
        },
        dependenciesMeta: {
          [`no-deps`]: {
            unplugged: true,
          },
        },
      },
      async ({path, run, source}) => {
        await run(`install`);

        const listing = await xfs.readdirPromise(`${path}/.yarn/unplugged`);
        expect(listing).toHaveLength(1);

        await writeFile(
          `${path}/.yarn/unplugged/${listing[0]}/node_modules/no-deps/index.js`,
          `module.exports = "unplugged";\n`,
        );

        await expect(source(`require('no-deps')`)).resolves.toEqual(`unplugged`);
      },
    ),
  );

  test(
    `it should allow unplugging a deep package from a pnp installation`,
    makeTemporaryEnv(
      {
        dependencies: {
          [`one-fixed-dep`]: `1.0.0`,
        },
        dependenciesMeta: {
          [`no-deps`]: {
            unplugged: true,
          },
        },
      },
      async ({path, run, source}) => {
        await run(`install`);

        const listing = await xfs.readdirPromise(`${path}/.yarn/unplugged`);
        expect(listing).toHaveLength(1);

        await writeFile(
          `${path}/.yarn/unplugged/${listing[0]}/node_modules/no-deps/index.js`,
          `module.exports = "unplugged";\n`,
        );

        await expect(source(`require('one-fixed-dep')`)).resolves.toMatchObject({
          dependencies: {
            [`no-deps`]: `unplugged`,
          },
        });
      },
    ),
  );

  test(
    `it should allow unplugging multiple identically named packages from a pnp installation`,
    makeTemporaryEnv(
      {
        dependencies: {
          [`one-fixed-dep`]: `1.0.0`,
          [`no-deps`]: `2.0.0`,
        },
        dependenciesMeta: {
          [`no-deps`]: {
            unplugged: true,
          },
        },
      },
      async ({path, run, source}) => {
        await run(`install`);

        const listing = await xfs.readdirPromise(`${path}/.yarn/unplugged`);
        expect(listing).toHaveLength(2);
      },
    ),
  );

  test(
    `it should allow picking the unplugged packages by locator`,
    makeTemporaryEnv(
      {
        dependencies: {
          [`one-fixed-dep`]: `1.0.0`,
          [`no-deps`]: `2.0.0`,
        },
        dependenciesMeta: {
          [`no-deps@1.0.0`]: {
            unplugged: true,
          },
        },
      },
      async ({path, run, source}) => {
        await run(`install`);

        const listing = await xfs.readdirPromise(`${path}/.yarn/unplugged`);
        expect(listing).toHaveLength(1);

        expect(listing[0]).toMatch(/1.0.0/);
      },
    ),
  );

  test(
    `it should properly unplug a package with peer dependencies`,
    makeTemporaryEnv(
      {
        dependencies: {
          [`provides-peer-deps-1-0-0`]: `1.0.0`,
          [`provides-peer-deps-2-0-0`]: `1.0.0`,
        },
        dependenciesMeta: {
          [`no-deps`]: {
            unplugged: true,
          },
          [`peer-deps`]: {
            unplugged: true,
          },
        },
      },
      async ({path, run, source}) => {
        await run(`install`);

        await expect(
          source(`require('provides-peer-deps-1-0-0') !== require('provides-peer-deps-2-0-0')`),
        ).resolves.toEqual(true);

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
    `it should not override an already unplugged package`,
    makeTemporaryEnv(
      {
        dependencies: {
          [`no-deps`]: `1.0.0`,
        },
        dependenciesMeta: {
          [`no-deps`]: {
            unplugged: true,
          },
        },
      },
      async ({path, run, source}) => {
        await run(`install`);

        const listing = await xfs.readdirPromise(`${path}/.yarn/unplugged`);
        expect(listing).toHaveLength(1);

        await writeFile(
          `${path}/.yarn/unplugged/${listing[0]}/node_modules/no-deps/index.js`,
          `module.exports = "unplugged";\n`,
        );

        await run(`install`);

        await expect(source(`require('no-deps')`)).resolves.toEqual(`unplugged`);
      },
    ),
  );

  test(
    `it should not automatically unplug all packages`,
    makeTemporaryEnv(
      {
        dependencies: {
          [`no-deps`]: `1.0.0`,
        },
      },
      async ({path, run, source}) => {
        await run(`install`);

        expect(xfs.existsSync(`${path}/.yarn/unplugged`)).toEqual(false);
      },
    ),
  );

  test(
    `it should automatically unplug packages with postinstall scripts`,
    makeTemporaryEnv(
      {
        dependencies: {[`no-deps-scripted`]: `1.0.0`},
      },
      async ({path, run, source}) => {
        await run(`install`);

        const listing = await xfs.readdirPromise(`${path}/.yarn/unplugged`);
        expect(listing).toHaveLength(1);
      },
    ),
  );

  test(
    `it should allow packages to define whether they should be unplugged (true)`,
    makeTemporaryEnv(
      {
        dependencies: {[`prefer-unplugged-true`]: `1.0.0`},
      },
      async ({path, run, source}) => {
        await run(`install`);

        const listing = await xfs.readdirPromise(`${path}/.yarn/unplugged`);
        expect(listing).toHaveLength(1);
      },
    ),
  );

  test(
    `it should allow packages to define whether they should be unplugged (false)`,
    makeTemporaryEnv(
      {
        dependencies: {[`prefer-unplugged-false`]: `1.0.0`},
      },
      async ({path, run, source}) => {
        await run(`install`);

        expect(xfs.existsSync(`${path}/.yarn/unplugged`)).toEqual(false);
      },
    ),
  );

  test(
    `it should not cache the postinstall artifacts`,
    makeTemporaryEnv(
      {
        dependencies: {[`no-deps-scripted`]: `1.0.0`},
      },
      async ({path, run, source}) => {
        await run(`install`);

        const rndBefore = await source(`require('no-deps-scripted/rnd.js')`);

        await xfs.removePromise(`${path}/.yarn`);
        await xfs.removePromise(`${path}/.pnp.js`);

        await run(`install`);

        const rndAfter = await source(`require('no-deps-scripted/rnd.js')`);

        // It might fail once every blue moon, when the two random numbers are equal
        expect(rndAfter).not.toEqual(rndBefore);
      },
    ),
    15000,
  );

  test(
    `it should not break spawning new Node processes ('node' command)`,
    makeTemporaryEnv(
      {
        dependencies: {[`no-deps`]: `1.0.0`},
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
    makeTemporaryEnv({}, async ({path, run, source}) => {
      await run(`install`);

      await writeFile(`${path}/foo.js`, `console.log(42);`);

      await expect(
        run(`node`, `-e`, `console.log(21);`, {env: {NODE_OPTIONS: `--require ${npath.fromPortablePath(path)}/foo`}}),
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
    }, async ({path, run, source}) => {
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
    makeTemporaryEnv({}, async ({path, run, source}) => {
      await xfs.mkdirpPromise(`${path}/node_modules/foo`);

      await run(`install`);

      await expect(xfs.readdirPromise(path)).resolves.not.toContain(`node_modules`);
    }),
  );

  test(
    `it shouldn't remove the lingering node_modules folders when they contain dot-folders`,
    makeTemporaryEnv({}, async ({path, run, source}) => {
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
    makeTemporaryEnv({}, async ({path, run, source}) => {
      await xfs.mkdirpPromise(`${path}/node_modules/.bin`);
      await xfs.mkdirpPromise(`${path}/node_modules/.cache`);
      await xfs.mkdirpPromise(`${path}/node_modules/foo`);

      await run(`install`);

      await expect(xfs.readdirPromise(path)).resolves.toContain(`node_modules`);
      await expect(xfs.readdirPromise(ppath.join(path, `node_modules`))).resolves.toEqual([
        `.cache`,
      ]);
    }),
  );

  test(
    `it should transparently support the "resolve" package`,
    makeTemporaryEnv(
      {
        dependencies: {
          [`resolve`]: `1.9.0`,
        },
      },
      async ({path, run, source}) => {
        await run(`install`);

        await expect(source(`require('resolve').sync('resolve')`)).resolves.toEqual(
          await source(`require.resolve('resolve')`),
        );

        await expect(source(`require('resolve').sync('resolve/package.json')`)).resolves.toEqual(
          await source(`require.resolve('resolve/package.json')`),
        );
      },
    ),
    15000,
  );

  test(
    `it shouldn't break the vscode builtin resolution`,
    makeTemporaryEnv({}, async ({path, run, source}) => {
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

        require(process.argv[2]).setup();

        if (require('foo') !== 'this works') {
          throw new Error('Assertion failed');
        }
      `);

      cp.execFileSync(`node`, [
        npath.fromPortablePath(`${tmp}/index.js`),
        npath.fromPortablePath(`${path}/.pnp.js`),
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
        expect(stdout).toMatch(new RegExp(`dep@file:./dep.*The platform ${process.platform} is incompatible with this module, building skipped.`));

        await expect(source(`require('dep')`)).resolves.toMatchObject({
          name: `dep`,
          version: `1.0.0`,
        });
      },
    ),
  );

  test(
    `it should work with pnpEnableInlining set to false`,
    makeTemporaryEnv({}, {
      pnpEnableInlining: false,
    }, async ({path, run, source}) => {
      await run(`add`, `no-deps`);

      expect(xfs.existsSync(`${path}/.pnp.data.json`)).toBeTruthy();

      await writeFile(`${path}/file.js`, `
        console.log(require.resolve('no-deps'));
      `);

      await expect(run(`node`, `file.js`)).resolves.toBeTruthy();
    }),
  );

  test(
    `it should work with pnpEnableInlining set to false and with a custom pnpDataPath`,
    makeTemporaryEnv({}, {
      pnpEnableInlining: false,
      pnpDataPath: `./.pnp.meta.json`,
    }, async ({path, run, source}) => {
      await run(`add`, `no-deps`);

      expect(xfs.existsSync(`${path}/.pnp.meta.json`)).toBeTruthy();

      await writeFile(`${path}/file.js`, `
        console.log(require.resolve('no-deps'));
      `);

      await expect(run(`node`, `file.js`)).resolves.toBeTruthy();
    }),
  );
});
