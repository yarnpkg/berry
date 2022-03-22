import {Filename, ppath, xfs} from '@yarnpkg/fslib';

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
    `it should allow relative imports with search params`,
    makeTemporaryEnv(
      {},
      {
        pnpEnableEsmLoader: true,
      },
      async ({path, run, source}) => {
        await expect(run(`install`)).resolves.toMatchObject({code: 0});

        await xfs.writeFilePromise(ppath.join(path, `index.mjs` as Filename), `import './foo.mjs?cache=false'`);
        await xfs.writeFilePromise(ppath.join(path, `foo.mjs` as Filename), ``);

        await expect(run(`node`, `index.mjs`)).resolves.toMatchObject({
          code: 0,
          stdout: ``,
          stderr: ``,
        });
      },
    ),
  );

  test(
    `it should preserve search params in the resolve result (cache busting)`,
    makeTemporaryEnv(
      {},
      {
        pnpEnableEsmLoader: true,
      },
      async ({path, run, source}) => {
        await expect(run(`install`)).resolves.toMatchObject({code: 0});

        await xfs.writeFilePromise(ppath.join(path, `index.mjs` as Filename), `
          (async () => {
            process.env.FOO = '1';
            console.log((await import('./foo.mjs')).default); // 1
            process.env.FOO = '2';
            console.log((await import('./foo.mjs')).default); // 1
            console.log((await import('./foo.mjs?rev=42')).default); // 2
            console.log((await import('./foo.mjs?rev=42')).default); // 2
          })();
        `);
        await xfs.writeFilePromise(ppath.join(path, `foo.mjs` as Filename), `export default process.env.FOO`);

        await expect(run(`node`, `index.mjs`)).resolves.toMatchObject({
          code: 0,
          stdout: `1\n1\n2\n2\n`,
          stderr: ``,
        });
      },
    ),
  );

  test(
    `it should allow absolute imports with search params`,
    makeTemporaryEnv(
      {},
      {
        pnpEnableEsmLoader: true,
      },
      async ({path, run, source}) => {
        await expect(run(`install`)).resolves.toMatchObject({code: 0});

        await xfs.writeFilePromise(ppath.join(path, `index.mjs` as Filename), `
          import(new URL('./foo.mjs?cache=false', import.meta.url))
        `);
        await xfs.writeFilePromise(ppath.join(path, `foo.mjs` as Filename), ``);

        await expect(run(`node`, `index.mjs`)).resolves.toMatchObject({
          code: 0,
          stdout: ``,
          stderr: ``,
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
            `we looked for the following paths, but none could be accessed`,
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
          'no-deps': `1.0.0`,
        },
      },
      async ({path, run, source}) => {
        await xfs.writeFilePromise(ppath.join(path, `index.js` as Filename), `import pkg from 'no-deps';\nconsole.log(pkg)`);

        await expect(run(`install`)).resolves.toMatchObject({code: 0});

        await expect(run(`node`, `./index.js`)).resolves.toMatchObject({
          code: 0,
          stdout: `{ name: 'no-deps', version: '1.0.0' }\n`,
        });
      },
    ),
  );

  test(
    `it should load commonjs with an unknown extension`,
    makeTemporaryEnv(
      {
      },
      async ({path, run, source}) => {
        await xfs.writeFilePromise(ppath.join(path, `index.ts` as Filename), `console.log(typeof require === 'undefined')`);

        await expect(run(`install`)).resolves.toMatchObject({code: 0});

        await expect(run(`node`, `./index.ts`)).resolves.toMatchObject({
          code: 0,
          stdout: `false\n`,
        });
      },
    ),
  );

  test(
    `it should not allow unknown extensions with {type: "module"}`,
    makeTemporaryEnv(
      {
        type: `module`,
      },
      async ({path, run, source}) => {
        await xfs.writeFilePromise(ppath.join(path, `index.ts` as Filename), ``);

        await expect(run(`install`)).resolves.toMatchObject({code: 0});

        await expect(run(`node`, `./index.ts`)).rejects.toMatchObject({
          code: 1,
          stderr: expect.stringContaining(`Unknown file extension ".ts"`),
        });
      },
    ),
  );

  // Tests https://github.com/nodejs/node/issues/33226
  test(
    `it should load extensionless commonjs files as an entrypoint`,
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
    `it should not allow extensionless commonjs imports`,
    makeTemporaryEnv(
      { },
      {
        pnpEnableEsmLoader: true,
      },
      async ({path, run, source}) => {
        await xfs.writeFilePromise(ppath.join(path, `index.mjs` as Filename), `import bin from './cjs-bin';\nconsole.log(bin)`);
        await xfs.writeFilePromise(ppath.join(path, `cjs-bin` as Filename), `module.exports = {foo: 'bar'}`);

        await expect(run(`install`)).resolves.toMatchObject({code: 0});

        await expect(run(`node`, `./index.mjs`)).rejects.toMatchObject({
          code: 1,
          stderr: expect.stringContaining(`Unknown file extension`),
        });
      },
    ),
  );

  test(
    `it should not allow extensionless files with {"type": "module"}`,
    makeTemporaryEnv(
      {
        type: `module`,
      },
      {
        pnpEnableEsmLoader: true,
      },
      async ({path, run, source}) => {
        await xfs.writeFilePromise(ppath.join(path, `index` as Filename), ``);

        await expect(run(`install`)).resolves.toMatchObject({code: 0});

        await expect(run(`node`, `./index`)).rejects.toMatchObject({
          code: 1,
          stderr: expect.stringContaining(`Unknown file extension`),
        });
      },
    ),
  );

  test(
    `it should support ESM binaries`,
    makeTemporaryEnv(
      {
        dependencies: {
          'no-deps-bins-esm': `1.0.0`,
        },
      },
      async ({path, run, source}) => {
        await expect(run(`install`)).resolves.toMatchObject({code: 0});

        await expect(run(`no-deps-bins-esm`)).resolves.toMatchObject({
          code: 0,
          stdout: `42\n`,
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
    `it should support dynamic imports in ESM mode`,
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

  test(
    `it should support dynamic imports in commonjs mode`,
    makeTemporaryEnv(
      {
        dependencies: {
          "no-deps": `1.0.0`,
          "is-number": `1.0.0`,
        },
      },
      {
        pnpEnableEsmLoader: true,
      },
      async ({path, run, source}) => {
        await xfs.writeFilePromise(ppath.join(path, `index.js` as Filename), `require('no-deps');\nimport('is-number').then(() => console.log(42))`);

        await expect(run(`install`)).resolves.toMatchObject({code: 0});

        await expect(run(`node`, `index.js`)).resolves.toMatchObject({
          code: 0,
          stdout: expect.stringMatching(`42\n`),
        });
      },
    ),
  );

  test(
    `it should set the main module`,
    makeTemporaryEnv(
      {},
      {
        pnpEnableEsmLoader: true,
      },
      async ({path, run, source}) => {
        await expect(run(`install`)).resolves.toMatchObject({code: 0});

        await xfs.writeFilePromise(
          ppath.join(path, `index.js` as Filename),
          `
            console.log({
              require: typeof require,
              main: require.main === module,
              mainModule: process.mainModule === module,
            });
          `,
        );

        await expect(run(`node`, `index.js`)).resolves.toMatchObject({
          code: 0,
          stdout: `{ require: 'function', main: true, mainModule: true }\n`,
        });
      },
    ),
  );

  test(
    `it should suppress the experimental ESM loader warning`,
    makeTemporaryEnv(
      {},
      {
        pnpEnableEsmLoader: true,
      },
      async ({path, run, source}) => {
        await expect(run(`install`)).resolves.toMatchObject({code: 0});

        await xfs.writeFilePromise(ppath.join(path, `index.mjs` as Filename), ``);

        await expect(run(`node`, `index.mjs`)).resolves.toMatchObject({
          code: 0,
          stdout: ``,
          stderr: ``,
        });
      },
    ),
  );

  test(
    `it should throw ERR_REQUIRE_ESM when requiring a file with type=module`,
    makeTemporaryEnv(
      {
        dependencies: {
          'no-deps-esm': `1.0.0`,
        },
      },
      {
        pnpEnableEsmLoader: true,
      },
      async ({path, run, source}) => {
        await expect(run(`install`)).resolves.toMatchObject({code: 0});

        await xfs.writeFilePromise(ppath.join(path, `index.js` as Filename), `
          try {
            require('no-deps-esm')
          } catch (err) {
            console.log(err.code)
          }
        `);

        await expect(run(`node`, `index.js`)).resolves.toMatchObject({
          code: 0,
          stdout: `ERR_REQUIRE_ESM\n`,
        });
      },
    ),
  );

  test(
    `it should throw ERR_REQUIRE_ESM when requiring a .mjs file`,
    makeTemporaryEnv(
      {
        dependencies: {
          'no-deps-mjs': `1.0.0`,
        },
      },
      {
        pnpEnableEsmLoader: true,
      },
      async ({path, run, source}) => {
        await expect(run(`install`)).resolves.toMatchObject({code: 0});

        await xfs.writeFilePromise(ppath.join(path, `index.js` as Filename), `
          try {
            require('no-deps-mjs/index.mjs')
          } catch (err) {
            console.log(err.code)
          }
        `);

        await expect(run(`node`, `index.js`)).resolves.toMatchObject({
          code: 0,
          stdout: `ERR_REQUIRE_ESM\n`,
        });
      },
    ),
  );
});
