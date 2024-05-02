import {Filename, npath, ppath, xfs}                                                                                            from '@yarnpkg/fslib';
import {ALLOWS_EXTENSIONLESS_FILES, HAS_LOADERS_AFFECTING_LOADERS, SUPPORTS_IMPORT_ATTRIBUTES, SUPPORTS_IMPORT_ATTRIBUTES_ONLY} from '@yarnpkg/pnp/sources/esm-loader/loaderFlags';
import {pathToFileURL}                                                                                                          from 'url';

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
          ppath.join(path, `index.js`),
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
          ppath.join(path, `index.js`),
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
    `it should be able to import the PnP API`,
    makeTemporaryEnv(
      {
        type: `module`,
      },
      async ({path, run, source}) => {
        await expect(run(`install`)).resolves.toMatchObject({code: 0});

        await xfs.writeFilePromise(
          ppath.join(path, `index.js`),
          `import pnp from 'pnpapi';\nconsole.log(typeof pnp.resolveRequest)`,
        );

        await expect(run(`node`, `./index.js`)).resolves.toMatchObject({
          code: 0,
          stdout: `function\n`,
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
          ppath.join(path, `index.js`),
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
          ppath.join(path, `index.js`),
          `import foo from './foo.js';\nconsole.log(foo)`,
        );
        await xfs.writeFilePromise(ppath.join(path, `foo.js`), `export default 42`);

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

        await xfs.writeFilePromise(ppath.join(path, `index.mjs`), `import './foo.mjs?cache=false'`);
        await xfs.writeFilePromise(ppath.join(path, `foo.mjs`), ``);

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

        await xfs.writeFilePromise(ppath.join(path, `index.mjs`), `
          (async () => {
            process.env.FOO = '1';
            console.log((await import('./foo.mjs')).default); // 1
            process.env.FOO = '2';
            console.log((await import('./foo.mjs')).default); // 1
            console.log((await import('./foo.mjs?rev=42')).default); // 2
            console.log((await import('./foo.mjs?rev=42')).default); // 2
          })();
        `);
        await xfs.writeFilePromise(ppath.join(path, `foo.mjs`), `export default process.env.FOO`);

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

        await xfs.writeFilePromise(ppath.join(path, `index.mjs`), `
          import(new URL('./foo.mjs?cache=false', import.meta.url))
        `);
        await xfs.writeFilePromise(ppath.join(path, `foo.mjs`), ``);

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
          ppath.join(path, `index.js`),
          `import './foo';`,
        );
        await xfs.writeFilePromise(ppath.join(path, `foo.js`), ``);

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
    `it should not resolve JSON modules without an import assertion/attribute`,
    makeTemporaryEnv(
      {
        type: `module`,
      },
      async ({path, run, source}) => {
        await expect(run(`install`)).resolves.toMatchObject({code: 0});

        await xfs.writeFilePromise(
          ppath.join(path, `index.js`),
          `import './foo.json';`,
        );
        await xfs.writeFilePromise(ppath.join(path, `foo.json`), `{"name": "foo"}`);

        await expect(run(`node`, `./index.js`)).rejects.toMatchObject({
          code: 1,
          stderr: expect.stringContaining(SUPPORTS_IMPORT_ATTRIBUTES_ONLY ? `ERR_IMPORT_ATTRIBUTE_MISSING` : `ERR_IMPORT_ASSERTION_TYPE_MISSING`),
        });
      },
    ),
  );

  test(
    `it should resolve JSON modules with an import assertion/attribute`,
    makeTemporaryEnv(
      {
        type: `module`,
      },
      async ({path, run, source}) => {
        await expect(run(`install`)).resolves.toMatchObject({code: 0});

        await xfs.writeFilePromise(
          ppath.join(path, `index.js`),
          `
          import foo from './foo.json' ${SUPPORTS_IMPORT_ATTRIBUTES ? `with` : `assert`} { type: 'json' };
          console.log(foo.name);
          `,
        );
        await xfs.writeFilePromise(ppath.join(path, `foo.json`), `{"name": "foo"}`);

        await expect(run(`node`, `./index.js`)).resolves.toMatchObject({
          code: 0,
          stdout: `foo\n`,
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
        await xfs.mkdirPromise(ppath.join(path, `pkg`));
        await xfs.writeJsonPromise(ppath.join(path, `pkg/package.json`), {
          exports: {
            import: `./foo.mjs`,
          },
        });
        await xfs.writeFilePromise(ppath.join(path, `pkg/foo.mjs`), `export default 42`);

        await xfs.writeFilePromise(ppath.join(path, `index.js`), `import foo from 'foo';\nconsole.log(foo)`);

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
        await xfs.writeFilePromise(ppath.join(path, `index.js`), `import pkg from 'no-deps';\nconsole.log(pkg)`);

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
        await xfs.writeFilePromise(ppath.join(path, `index.ts`), `console.log(typeof require === 'undefined')`);

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
        await xfs.writeFilePromise(ppath.join(path, `index.ts`), ``);

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
        await xfs.writeFilePromise(ppath.join(path, `index`), `console.log(typeof require === 'undefined')`);

        await expect(run(`install`)).resolves.toMatchObject({code: 0});

        await expect(run(`node`, `./index`)).resolves.toMatchObject({
          code: 0,
          stdout: `false\n`,
        });
      },
    ),
  );

  test(
    `it should load symlinked extensionless commonjs files as an entrypoint`,
    makeTemporaryEnv(
      { },
      {
        pnpEnableEsmLoader: true,
      },
      async ({path, run, source}) => {
        await xfs.mkdirPromise(ppath.join(path, `lib`));
        await xfs.writeFilePromise(ppath.join(path, `lib/index`), `console.log(typeof require === 'undefined')`);
        await xfs.symlinkPromise(ppath.join(path, `lib` as Filename), ppath.join(path, `symlink`), `junction`);

        await expect(run(`install`)).resolves.toMatchObject({code: 0});

        await expect(run(`node`, `./symlink/index`)).resolves.toMatchObject({
          code: 0,
          stdout: `false\n`,
        });
      },
    ),
  );

  (ALLOWS_EXTENSIONLESS_FILES ? it.skip : it)(
    `it should not allow extensionless commonjs imports`,
    makeTemporaryEnv(
      { },
      {
        pnpEnableEsmLoader: true,
      },
      async ({path, run, source}) => {
        await xfs.writeFilePromise(ppath.join(path, `index.mjs`), `import bin from './cjs-bin';\nconsole.log(bin)`);
        await xfs.writeFilePromise(ppath.join(path, `cjs-bin`), `module.exports = {foo: 'bar'}`);

        await expect(run(`install`)).resolves.toMatchObject({code: 0});

        await expect(run(`node`, `./index.mjs`)).rejects.toMatchObject({
          code: 1,
          stderr: expect.stringContaining(`Unknown file extension`),
        });
      },
    ),
  );

  (ALLOWS_EXTENSIONLESS_FILES ? it : it.skip)(
    `it should allow extensionless commonjs imports`,
    makeTemporaryEnv(
      { },
      {
        pnpEnableEsmLoader: true,
      },
      async ({path, run, source}) => {
        await xfs.writeFilePromise(ppath.join(path, `index.mjs`), `import bin from './cjs-bin';\nconsole.log(bin)`);
        await xfs.writeFilePromise(ppath.join(path, `cjs-bin`), `module.exports = 42`);

        await expect(run(`install`)).resolves.toMatchObject({code: 0});

        await expect(run(`node`, `./index.mjs`)).resolves.toMatchObject({
          stdout: `42\n`,
        });
      },
    ),
  );

  (ALLOWS_EXTENSIONLESS_FILES ? it.skip : it)(
    `it should not allow extensionless files with {"type": "module"}`,
    makeTemporaryEnv(
      {
        type: `module`,
      },
      {
        pnpEnableEsmLoader: true,
      },
      async ({path, run, source}) => {
        await xfs.writeFilePromise(ppath.join(path, `index`), `console.log(42)`);

        await expect(run(`install`)).resolves.toMatchObject({code: 0});

        await expect(run(`node`, `./index`)).rejects.toMatchObject({
          code: 1,
          stderr: expect.stringContaining(`Unknown file extension`),
        });
      },
    ),
  );

  (ALLOWS_EXTENSIONLESS_FILES ? it : it.skip)(
    `it should allow extensionless files with {"type": "module"}`,
    makeTemporaryEnv(
      {
        type: `module`,
      },
      {
        pnpEnableEsmLoader: true,
      },
      async ({path, run, source}) => {
        await xfs.writeFilePromise(ppath.join(path, `index`), `console.log(42)`);

        await expect(run(`install`)).resolves.toMatchObject({code: 0});

        await expect(run(`node`, `./index`)).resolves.toMatchObject({
          stdout: `42\n`,
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
        await xfs.writeFilePromise(ppath.join(path, `index.js`), `import('no-deps').then(() => console.log(42))`);

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
        await xfs.writeFilePromise(ppath.join(path, `index.js`), `require('no-deps');\nimport('is-number').then(() => console.log(42))`);

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
          ppath.join(path, `index.js`),
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

        await xfs.writeFilePromise(ppath.join(path, `index.mjs`), ``);

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

        await xfs.writeFilePromise(ppath.join(path, `index.js`), `
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

        await xfs.writeFilePromise(ppath.join(path, `index.js`), `
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

  test(
    `it should throw ERR_MODULE_NOT_FOUND when statically importing a nonexistent file`,
    makeTemporaryEnv(
      {
        type: `module`,
      },
      async ({path, run, source}) => {
        await expect(run(`install`)).resolves.toMatchObject({code: 0});

        await xfs.writeFilePromise(ppath.join(path, `index.js`), `
          import("./foo.js").catch((err) => {
            console.log(err.code)
          })
        `);

        await xfs.writeFilePromise(ppath.join(path, `foo.js`), `import './nonexistent.js'`);

        await expect(run(`node`, `index.js`)).resolves.toMatchObject({
          code: 0,
          stdout: `ERR_MODULE_NOT_FOUND\n`,
        });
      },
    ),
  );

  test(
    `it should throw ERR_MODULE_NOT_FOUND when dynamically importing a nonexistent file`,
    makeTemporaryEnv(
      {
        type: `module`,
      },
      async ({path, run, source}) => {
        await expect(run(`install`)).resolves.toMatchObject({code: 0});

        await xfs.writeFilePromise(ppath.join(path, `index.js`), `
          import("./nonexistent.js").catch((err) => {
            console.log(err.code)
          })
        `);

        await expect(run(`node`, `index.js`)).resolves.toMatchObject({
          code: 0,
          stdout: `ERR_MODULE_NOT_FOUND\n`,
        });
      },
    ),
  );

  test(
    `it should throw ERR_PACKAGE_PATH_NOT_EXPORTED when subpath isn't exported`,
    makeTemporaryEnv(
      {
        name: `foo`,
        type: `module`,
        exports: {
          './package.json': `./package.json`,
        },
      },
      async ({path, run, source}) => {
        await expect(run(`install`)).resolves.toMatchObject({code: 0});

        await xfs.writeFilePromise(ppath.join(path, `index.mjs`), `
          import('foo/bar').catch(err => {
            console.log(err.code)
          });
        `);

        await expect(run(`node`, `./index.mjs`)).resolves.toMatchObject({
          code: 0,
          stdout: `ERR_PACKAGE_PATH_NOT_EXPORTED\n`,
        });
      },
    ),
  );

  // Tests /packages/yarnpkg-pnp/sources/esm-loader/fspatch.ts
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
          ppath.join(path, `index.js`),
          `import {foo} from 'no-deps-exports';\nconsole.log(foo)`,
        );

        await expect(run(`node`, `./index.js`)).resolves.toMatchObject({
          code: 0,
          stdout: `42\n`,
        });
      },
    ),
  );

  // Tests /packages/yarnpkg-pnp/sources/esm-loader/fspatch.ts
  (HAS_LOADERS_AFFECTING_LOADERS ? it : it.skip)(
    `should support loaders importing named exports from commonjs files`,
    makeTemporaryEnv(
      {
        dependencies: {
          'no-deps-exports': `1.0.0`,
        },
        type: `module`,
      },
      async ({path, run, source}) => {
        await xfs.writeFilePromise(ppath.join(path, `loader.mjs`), `
          import {foo} from 'no-deps-exports';
          console.log(foo);
        `);
        await xfs.writeFilePromise(ppath.join(path, `index.js`), ``);

        await expect(run(`install`)).resolves.toMatchObject({code: 0});

        await expect(run(`node`, `--loader`, `./loader.mjs`, `./index.js`)).resolves.toMatchObject({
          code: 0,
          stdout: `42\n`,
          stderr: ``,
        });
      },
    ),
  );

  describe(`private import mappings`, () => {
    test(
      `it should support private import mappings`,
      makeTemporaryEnv(
        {
          type: `module`,
          imports: {
            "#foo": `./foo.js`,
          },
        },
        async ({path, run, source}) => {
          await expect(run(`install`)).resolves.toMatchObject({code: 0});

          await xfs.writeFilePromise(
            ppath.join(path, `index.js`),
            `import {foo} from '#foo';\nconsole.log(foo)`,
          );
          await xfs.writeFilePromise(
            ppath.join(path, `foo.js`),
            `export const foo = 42;`,
          );

          await expect(run(`node`, `./index.js`)).resolves.toMatchObject({
            code: 0,
            stdout: `42\n`,
          });
        },
      ),
    );

    test(
      `it should support conditions`,
      makeTemporaryEnv(
        {
          type: `module`,
          imports: {
            "#foo": {
              node: `./foo.js`,
              default: `./404.js`,
            },
          },
        },
        async ({path, run, source}) => {
          await expect(run(`install`)).resolves.toMatchObject({code: 0});

          await xfs.writeFilePromise(
            ppath.join(path, `index.js`),
            `import {foo} from '#foo';\nconsole.log(foo)`,
          );
          await xfs.writeFilePromise(
            ppath.join(path, `foo.js`),
            `export const foo = 42;`,
          );

          await expect(run(`node`, `./index.js`)).resolves.toMatchObject({
            code: 0,
            stdout: `42\n`,
          });
        },
      ),
    );

    test(
      `it should use the closest manifest`,
      makeTemporaryEnv(
        {
          type: `module`,
          imports: {
            "#foo": `./foo/index.js`,
          },
        },
        async ({path, run, source}) => {
          await expect(run(`install`)).resolves.toMatchObject({code: 0});

          await xfs.mkdirPromise(ppath.join(path, `foo`));
          await xfs.writeJsonPromise(ppath.join(path, `foo/package.json`), {
            type: `module`,
            imports: {
              "#bar": `./bar.js`,
            },
          });
          await xfs.writeFilePromise(
            ppath.join(path, `foo/bar.js`),
            `export const bar = 42;`,
          );
          await xfs.writeFilePromise(ppath.join(path, `foo/index.js`), `export * from '#bar';`);

          await xfs.writeFilePromise(
            ppath.join(path, `index.js`),
            `import {bar} from '#foo';\nconsole.log(bar)`,
          );

          await expect(run(`node`, `./index.js`)).resolves.toMatchObject({
            code: 0,
            stdout: `42\n`,
          });
        },
      ),
    );

    test(
      `it should support mapping to a dependency`,
      makeTemporaryEnv(
        {
          type: `module`,
          dependencies: {
            "no-deps": `1.0.0`,
          },
          imports: {
            "#foo/*": `no-deps/*`,
          },
        },
        async ({path, run, source}) => {
          await expect(run(`install`)).resolves.toMatchObject({code: 0});

          await xfs.writeFilePromise(
            ppath.join(path, `index.js`),
            `import noDeps from '#foo/index.js';\nconsole.log(noDeps)`,
          );

          await expect(run(`node`, `./index.js`)).resolves.toMatchObject({
            code: 0,
            stdout: `{ name: 'no-deps', version: '1.0.0' }\n`,
          });
        },
      ),
    );

    test(
      `it should use legacy resolve when mapping to a dependency without an exports field`,
      makeTemporaryEnv(
        {
          type: `module`,
          dependencies: {
            "no-deps": `1.0.0`,
          },
          imports: {
            "#foo": `no-deps`,
          },
        },
        async ({path, run, source}) => {
          await expect(run(`install`)).resolves.toMatchObject({code: 0});

          await xfs.writeFilePromise(
            ppath.join(path, `index.js`),
            `import noDeps from '#foo';\nconsole.log(noDeps)`,
          );

          await expect(run(`node`, `./index.js`)).resolves.toMatchObject({
            code: 0,
            stdout: `{ name: 'no-deps', version: '1.0.0' }\n`,
          });
        },
      ),
    );

    test(
      `it should support wildcards`,
      makeTemporaryEnv(
        {
          type: `module`,
          imports: {
            "#foo/*": `./*.js`,
          },
        },
        async ({path, run, source}) => {
          await expect(run(`install`)).resolves.toMatchObject({code: 0});

          await xfs.writeFilePromise(
            ppath.join(path, `index.js`),
            `import {foo} from '#foo/foo';\nconsole.log(foo)`,
          );
          await xfs.writeFilePromise(
            ppath.join(path, `foo.js`),
            `export const foo = 42;`,
          );

          await expect(run(`node`, `./index.js`)).resolves.toMatchObject({
            code: 0,
            stdout: `42\n`,
          });
        },
      ),
    );

    test(
      `it should not allow mapping to another private mapping`,
      makeTemporaryEnv(
        {
          type: `module`,
          imports: {
            "#foo": `#bar`,
            "#bar": `./bar.js`,
          },
        },
        async ({path, run, source}) => {
          await expect(run(`install`)).resolves.toMatchObject({code: 0});

          await xfs.writeFilePromise(
            ppath.join(path, `index.js`),
            `import {foo} from '#foo';\nconsole.log(foo)`,
          );
          await xfs.writeFilePromise(
            ppath.join(path, `bar.js`),
            `export const foo = 42;`,
          );

          await expect(run(`node`, `./index.js`)).rejects.toMatchObject({
            code: 1,
            stdout: ``,
            stderr: expect.stringContaining(`Mapping from one private import to another isn't allowed`),
          });
        },
      ),
    );

    test(
      `it should allow importing files regardless of parent URL`,
      makeTemporaryEnv(
        {
          type: `module`,
        },
        async ({path, run, source}) => {
          await expect(run(`install`)).resolves.toMatchObject({code: 0});

          await xfs.writeFilePromise(
            ppath.join(path, `loader.js`),
            `
            export function resolve(specifier, context, next) {
              if (specifier !== 'custom:foo') {
                return next(specifier, context);
              }

              return {
                shortCircuit: true,
                url: 'custom:foo',
              };
            }

            export function load(url, context, next) {
              if (url !== 'custom:foo') {
                return next(url, context);
              }

              return {
                format: 'module',
                source: "import { foo } from '${pathToFileURL(npath.fromPortablePath(ppath.join(path, `foo.js`)))}'\\nconsole.log(foo);",
                shortCircuit: true,
              };
            }
            `,
          );

          await xfs.writeFilePromise(
            ppath.join(path, `foo.js`),
            `export const foo = 42;`,
          );

          await xfs.writeFilePromise(
            ppath.join(path, `index.js`),
            `import 'custom:foo'`,
          );

          await expect(run(`node`, `--loader`, `./loader.js`, `./index.js`)).resolves.toMatchObject({
            code: 0,
            stdout: `42\n`,
            stderr: ``,
          });
        },
      ),
    );
  });

  it(
    `should use the commonjs resolver in commonjs files imported from ESM`,
    makeTemporaryEnv(
      {
        type: `module`,
      },
      async ({path, run, source}) => {
        await xfs.writeFilePromise(ppath.join(path, `foo.js`), `import './bar.cjs';`);
        await xfs.writeFilePromise(
          ppath.join(path, `bar.cjs`),
          `
          require('module')._extensions['.custom'] = require('module')._extensions['.js'];
          require('./baz');
          `,
        );
        await xfs.writeFilePromise(ppath.join(path, `baz.custom`), `console.log(42);`);

        await expect(run(`install`)).resolves.toMatchObject({code: 0});

        await expect(run(`node`, `./foo.js`)).resolves.toMatchObject({
          code: 0,
          stdout: `42\n`,
          stderr: ``,
        });
      },
    ),
  );
});
