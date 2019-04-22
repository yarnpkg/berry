const {NodeFS} = require(`@berry/fslib`);
const {satisfies} = require(`semver`);

const {
  fs: {createTemporaryFolder, writeFile, writeJson},
  tests: {testIf},
} = require(`pkg-tests-core`);

describe(`Require tests`, () => {
  test(
    `it should cache the loaded modules`,
    makeTemporaryEnv(
      {
        dependencies: {[`no-deps`]: `1.0.0`},
      },
      async ({path, run, source}) => {
        await run(`install`);

        await expect(
          source(
            `{ let before = require('no-deps/package.json'); let after = require('no-deps/package.json'); return before === after }`,
          ),
        ).resolves.toEqual(true);
      },
    ),
  );

  test(
    `it should expose the cached modules into require.cache`,
    makeTemporaryEnv(
      {
        dependencies: {[`no-deps`]: `1.0.0`},
      },
      async ({path, run, source}) => {
        await run(`install`);

        await expect(
          source(`require('no-deps') === require.cache[require.resolve('no-deps')].exports`),
        ).resolves.toEqual(true);
      },
    ),
  );

  test(
    `it should allow resetting a loaded module by deleting its entry from require.cache`,
    makeTemporaryEnv(
      {
        dependencies: {[`no-deps`]: `1.0.0`},
      },
      async ({path, run, source}) => {
        await run(`install`);

        await expect(
          source(
            `{ let before = require('no-deps/package.json'); delete require.cache[require.resolve('no-deps/package.json')]; let after = require('no-deps/package.json'); return before === after }`,
          ),
        ).resolves.toEqual(false);
      },
    ),
  );

  test(
    `it should correctly resolve native requires`,
    makeTemporaryEnv(
      {},
      async ({path, run, source}) => {
        await run(`install`);

        await expect(source(`require('fs').existsSync ? true : false`)).resolves.toEqual(true);
      },
    ),
  );

  test(
    `it should correctly resolve relative requires`,
    makeTemporaryEnv(
      {},
      async ({path, run, source}) => {
        await writeFile(`${path}/foo.js`, `module.exports = 42;\n`);

        await run(`install`);

        await expect(source(`require('./foo.js')`)).resolves.toEqual(42);
      },
    ),
  );

  test(
    `it should correctly resolve deep requires`,
    makeTemporaryEnv(
      {
        dependencies: {[`various-requires`]: `1.0.0`},
      },
      async ({path, run, source}) => {
        await run(`install`);

        await expect(source(`require('various-requires/alternative-index.js')`)).resolves.toEqual(42);
      },
    ),
  );

  test(
    `it should correctly resolve relative requires from within dependencies`,
    makeTemporaryEnv(
      {
        dependencies: {
          [`various-requires`]: `1.0.0`,
        },
      },
      async ({path, run, source}) => {
        await run(`install`);

        await expect(source(`require('various-requires/relative-require.js')`)).resolves.toEqual(42);
      },
    ),
  );

  test(
    `it should load the index.js file when loading from a folder`,
    makeTemporaryEnv({}, async ({path, run, source}) => {
      await run(`install`);

      const tmp = await createTemporaryFolder();

      await writeFile(`${tmp}/folder/index.js`, `module.exports = 42;`);

      await expect(source(`require(${JSON.stringify(tmp)} + "/folder")`)).resolves.toEqual(42);
    }),
  );

  test(
    `it should resolve the .js extension`,
    makeTemporaryEnv({}, async ({path, run, source}) => {
      await run(`install`);

      const tmp = await createTemporaryFolder();

      await writeFile(`${tmp}/file.js`, `module.exports = 42;`);

      await expect(source(`require(${JSON.stringify(NodeFS.fromPortablePath(tmp))} + "/file")`)).resolves.toEqual(42);
    }),
  );

  test(
    `it should ignore the "main" entry if it doesn't resolve`,
    makeTemporaryEnv(
      {
        dependencies: {
          [`invalid-main`]: `1.0.0`,
        },
      },
      async ({path, run, source}) => {
        await run(`install`);

        await expect(source(`require("invalid-main")`)).resolves.toMatchObject({
          name: `invalid-main`,
          version: `1.0.0`,
        });
      },
    ),
  );

  test(
    `it should support require(require.resolve(...))`,
    makeTemporaryEnv(
      {
        dependencies: {[`custom-dep-a`]: `file:./custom-dep-a`},
      },
      async ({path, run, source}) => {
        await writeFile(
          `${path}/custom-dep-a/index.js`,
          `module.exports = require('custom-dep-b')(require.resolve('no-deps'))`,
        );
        await writeJson(`${path}/custom-dep-a/package.json`, {
          name: `custom-dep-a`,
          version: `1.0.0`,
          dependencies: {[`custom-dep-b`]: `file:../custom-dep-b`, [`no-deps`]: `1.0.0`},
        });

        await writeFile(`${path}/custom-dep-b/index.js`, `module.exports = path => require(path)`);
        await writeJson(`${path}/custom-dep-b/package.json`, {name: `custom-dep-b`, version: `1.0.0`});

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
    `it should support require.resolve(..., {paths})`,
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
              `${NodeFS.fromPortablePath(path)}/workspace-a`,
              `${NodeFS.fromPortablePath(path)}/workspace-b`,
            ])}}))`,
          ),
        ).resolves.toMatchObject({
          name: `no-deps`,
          version: `1.0.0`,
        });
      },
    ),
  );
});
