import {Filename, PortablePath, ppath, xfs} from '@yarnpkg/fslib';

describe(`Plug'n'Play - ESM`, () => {
  test(
    `it should be able to import a node builtin`,
    makeTemporaryEnv(
      {
        type: `module`,
      },
      async ({path, run, source}) => {
        await expect(run(`install`)).resolves.toMatchObject({code: 0});

        await xfs.writeFilePromise(
          ppath.join(path, `index.js` as Filename),
          `import fs from 'fs';\nconsole.log(typeof fs.constants)`,
        );

        await expect(run(`node`, `./index.js`)).resolves.toMatchObject({
          code: 0,
          stdout: `object\n`,
        });
      },
    ),
  );

  test(
    `it should be able to import a node builtin through the node: protocol`,
    makeTemporaryEnv(
      {
        type: `module`,
      },
      async ({path, run, source}) => {
        await expect(run(`install`)).resolves.toMatchObject({code: 0});

        await xfs.writeFilePromise(
          ppath.join(path, `index.js` as Filename),
          `import fs from 'node:fs';\nconsole.log(typeof fs.constants)`,
        );

        await expect(run(`node`, `./index.js`)).resolves.toMatchObject({
          code: 0,
          stdout: `object\n`,
        });
      },
    ),
  );

  test(
    `it should be able to import a dependency`,
    makeTemporaryEnv(
      {
        type: `module`,
        dependencies: {
          "no-deps": `1.0.0`,
        },
      },
      async ({path, run, source}) => {
        await expect(run(`install`)).resolves.toMatchObject({code: 0});

        await xfs.writeFilePromise(
          ppath.join(path, `index.js` as Filename),
          `import noDeps from 'no-deps/index.js';\nconsole.log(noDeps)`,
        );

        await expect(run(`node`, `./index.js`)).resolves.toMatchObject({
          code: 0,
          stdout: `{ name: 'no-deps', version: '1.0.0' }\n`,
        });
      },
    ),
  );

  test(
    `it should support relative imports`,
    makeTemporaryEnv(
      {
        type: `module`,
      },
      async ({path, run, source}) => {
        await expect(run(`install`)).resolves.toMatchObject({code: 0});

        await xfs.writeFilePromise(
          ppath.join(path, `index.js` as Filename),
          `import foo from './foo.js';\nconsole.log(foo)`,
        );
        await xfs.writeFilePromise(ppath.join(path, `foo.js` as Filename), `export default 42`);

        await expect(run(`node`, `./index.js`)).resolves.toMatchObject({
          code: 0,
          stdout: `42\n`,
        });
      },
    ),
  );

  test(
    `it should not resolve extensions`,
    makeTemporaryEnv(
      {
        type: `module`,
      },
      async ({path, run, source}) => {
        await expect(run(`install`)).resolves.toMatchObject({code: 0});

        await xfs.writeFilePromise(
          ppath.join(path, `index.js` as Filename),
          `import './foo';`,
        );
        await xfs.writeFilePromise(ppath.join(path, `foo.js` as Filename), ``);

        await expect(run(`node`, `./index.js`)).rejects.toMatchObject({
          code: 1,
          stderr: expect.stringContaining(
            `none of those files can be found on the disk`,
          ),
        });
      },
    ),
  );

  test(
    `it should not resolve JSON files`,
    makeTemporaryEnv(
      {
        type: `module`,
      },
      async ({path, run, source}) => {
        await expect(run(`install`)).resolves.toMatchObject({code: 0});

        await xfs.writeFilePromise(
          ppath.join(path, `index.js` as Filename),
          `import './foo.json';`,
        );
        await xfs.writeFilePromise(ppath.join(path, `foo.json` as Filename), `{"name": "foo"}`);

        await expect(run(`node`, `./index.js`)).rejects.toMatchObject({
          code: 1,
          stderr: expect.stringContaining(`Unknown file extension`),
        });
      },
    ),
  );

  test(
    `it should support named exports in commonjs files`,
    makeTemporaryEnv(
      {
        dependencies: {
          'no-deps-exports': `1.0.0`,
        },
        type: `module`,
      },
      async ({path, run, source}) => {
        await expect(run(`install`)).resolves.toMatchObject({code: 0});

        await xfs.writeFilePromise(
          ppath.join(path, `index.js` as Filename),
          `import {foo} from 'no-deps-exports';\nconsole.log(foo)`,
        );

        await expect(run(`node`, `./index.js`)).resolves.toMatchObject({
          code: 0,
          stdout: `42\n`,
        });
      },
    ),
  );

  test(
    `it should always set default as module.exports when importing a commonjs file`,
    makeTemporaryEnv(
      {
        type: `module`,
      },
      async ({path, run, source}) => {
        await expect(run(`install`)).resolves.toMatchObject({code: 0});

        await xfs.writeFilePromise(
          ppath.join(path, `index.js` as Filename),
          `import foo from './foo.cjs';\nconsole.log(foo)`,
        );
        await xfs.writeFilePromise(
          ppath.join(path, `foo.cjs` as Filename),
          `module.exports.default = 42`,
        );

        await expect(run(`node`, `./index.js`)).resolves.toMatchObject({
          code: 0,
          stdout: `{ default: 42 }\n`,
        });
      },
    ),
  );

  test(
    `it should respect exports`,
    makeTemporaryEnv(
      {
        type: `module`,
        dependencies: {
          foo: `portal:./pkg`,
        },
      },
      async ({path, run, source}) => {
        await xfs.mkdirPromise(ppath.join(path, `pkg` as Filename));
        await xfs.writeJsonPromise(ppath.join(path, `pkg/package.json` as Filename), {
          exports: {
            import: `./foo.mjs`,
          },
        });
        await xfs.writeFilePromise(ppath.join(path, `pkg/foo.mjs` as Filename), `export default 42`);

        await xfs.writeFilePromise(ppath.join(path, `index.js` as Filename), `import foo from 'foo';\nconsole.log(foo)`);

        await expect(run(`install`)).resolves.toMatchObject({code: 0});

        await expect(run(`node`, `./index.js`)).resolves.toMatchObject({
          code: 0,
          stdout: `42\n`,
        });
      },
    ),
  );

  test(
    `it should use legacy resolve when exports is missing`,
    makeTemporaryEnv(
      {
        type: `module`,
        dependencies: {
          foo: `portal:./pkg`,
        },
      },
      async ({path, run, source}) => {
        await xfs.mkdirPromise(ppath.join(path, `pkg` as Filename));
        await xfs.writeJsonPromise(ppath.join(path, `pkg/package.json` as Filename), {});
        await xfs.writeFilePromise(ppath.join(path, `pkg/index.js` as Filename), `module.exports = 42`);

        await xfs.writeFilePromise(ppath.join(path, `index.js` as Filename), `import foo from 'foo';\nconsole.log(foo)`);

        await expect(run(`install`)).resolves.toMatchObject({code: 0});

        await expect(run(`node`, `./index.js`)).resolves.toMatchObject({
          code: 0,
          stdout: `42\n`,
        });
      },
    ),
  );

  test(
    `it should not allow unknown extensions`,
    makeTemporaryEnv(
      {
        type: `module`,
      },
      async ({path, run, source}) => {
        await xfs.writeFilePromise(ppath.join(path, `index` as Filename), `console.log('foo')`);

        await expect(run(`install`)).resolves.toMatchObject({code: 0});

        await expect(run(`node`, `./index`)).rejects.toMatchObject({
          code: 1,
          stderr: expect.stringContaining(`Unknown file extension ""`),
        });
      },
    ),
  );

  // Tests the workaround for https://github.com/nodejs/node/issues/33226
  test(
    `it should not enter ESM mode just because the loader is present`,
    makeTemporaryEnv(
      { },
      {
        pnpEnableEsmLoader: true,
      },
      async ({path, run, source}) => {
        await xfs.writeFilePromise(ppath.join(path, `index` as Filename), `console.log(typeof require === 'undefined')`);

        await expect(run(`install`)).resolves.toMatchObject({code: 0});

        await expect(run(`node`, `./index`)).resolves.toMatchObject({
          code: 0,
          stdout: `false\n`,
        });
      },
    ),
  );

  test(
    `it should enter ESM mode when entrypoint is ESM`,
    makeTemporaryEnv(
      {
        workspaces: [`workspace`],
        dependencies: {
          pkg: `workspace:*`,
        },
      },
      async ({path, run, source}) => {
        await xfs.mkdirPromise(ppath.join(path, `workspace` as PortablePath));
        await xfs.writeJsonPromise(ppath.join(path, `workspace/package.json` as PortablePath), {
          name: `pkg`,
          type: `module`,
          bin: `index.mjs`,
          peerDependencies: {
            'no-deps': `*`,
          },
        });
        await xfs.writeFilePromise(ppath.join(path, `workspace/index.mjs` as Filename), `import 'fs'; console.log('foo')`);

        await expect(run(`install`)).resolves.toMatchObject({code: 0});

        // Ensure path is virtual (ie node can't find it by default)
        await expect(run(`bin`, `pkg`)).resolves.toMatchObject({
          code: 0,
          stdout: expect.stringContaining(`__virtual__`),
        });

        await expect(run(`pkg`)).resolves.toMatchObject({
          code: 0,
          stdout: `foo\n`,
        });
      },
    ),
  );

  test(
    `it should enter ESM mode when target is ESM but the cwd doesn't have a pnpapi`,
    makeTemporaryEnv(
      {
      },
      async ({path, run, source}) => {
        await expect(run(`dlx`, `no-deps-bins-esm`)).resolves.toMatchObject({
          code: 0,
          stdout: expect.stringMatching(/\n42\n$/),
        });
      },
    ),
  );

  test(
    `it should work with dynamic imports in esm mode`,
    makeTemporaryEnv(
      {
        type: `module`,
        dependencies: {
          "no-deps": `1.0.0`,
        },
      },
      async ({path, run, source}) => {
        await xfs.writeFilePromise(ppath.join(path, `index.js` as Filename), `import('no-deps').then(() => console.log(42))`);

        await expect(run(`install`)).resolves.toMatchObject({code: 0});
        await expect(run(`node`, `index.js`)).resolves.toMatchObject({
          code: 0,
          stdout: expect.stringMatching(`42\n`),
        });
      },
    ),
  );

  // Requires the ESM loader to be loaded but currently that enters ESM
  // mode and would test the incorrect code path
  test.skip(
    `it should work with dynamic imports in commonjs mode`,
    makeTemporaryEnv(
      {
        dependencies: {
          "no-deps": `1.0.0`,
        },
      },
      {
        pnpEnableEsmLoader: true,
      },
      async ({path, run, source}) => {
        await xfs.writeFilePromise(ppath.join(path, `index.js` as Filename), `import('no-deps').then(() => console.log(42))`);

        await expect(run(`install`)).resolves.toMatchObject({code: 0});

        await expect(run(`node`, `index.js`)).resolves.toMatchObject({
          code: 0,
          stdout: expect.stringMatching(`42\n`),
        });
      },
    ),
  );
});
