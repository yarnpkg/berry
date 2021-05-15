import {Filename, ppath, xfs} from "@yarnpkg/fslib";

describe(`Plug'n'Play - ESM`, () => {
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
          `import noDeps from 'no-deps/index.js';\nconsole.log(noDeps)`
        );

        await expect(run(`node`, `./index.js`)).resolves.toMatchObject({
          code: 0,
          stdout: `{ name: 'no-deps', version: '1.0.0' }\n`,
        });
      }
    )
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
          `import foo from './foo.js';\nconsole.log(foo)`
        );
        await xfs.writeFilePromise(ppath.join(path, `foo.js` as Filename), `export default 42`);

        await expect(run(`node`, `./index.js`)).resolves.toMatchObject({
          code: 0,
          stdout: `42\n`,
        });
      }
    )
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
          `import './foo';`
        );
        await xfs.writeFilePromise(ppath.join(path, `foo.js` as Filename), ``);

        await expect(run(`node`, `./index.js`)).rejects.toMatchObject({
          code: 1,
          stderr: expect.stringContaining(
            `none of those files can be found on the disk`
          ),
        });
      }
    )
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
          `import './foo.json';`
        );
        await xfs.writeFilePromise(ppath.join(path, `foo.json` as Filename), `{"name": "foo"}`);

        await expect(run(`node`, `./index.js`)).rejects.toMatchObject({
          code: 1,
          stderr: expect.stringContaining(`Unknown file extension`),
        });
      }
    )
  );

  test(
    `it should support named exports in commonjs files`,
    makeTemporaryEnv(
      {
        type: `module`,
      },
      async ({path, run, source}) => {
        await expect(run(`install`)).resolves.toMatchObject({code: 0});

        await xfs.writeFilePromise(
          ppath.join(path, `index.js` as Filename),
          `import {foo} from './foo.cjs';\nconsole.log(foo)`
        );
        await xfs.writeFilePromise(
          ppath.join(path, `foo.cjs` as Filename),
          `module.exports.foo = 42`
        );

        await expect(run(`node`, `./index.js`)).resolves.toMatchObject({
          code: 0,
          stdout: `42\n`,
        });
      }
    )
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
          `import foo from './foo.cjs';\nconsole.log(foo)`
        );
        await xfs.writeFilePromise(
          ppath.join(path, `foo.cjs` as Filename),
          `module.exports.default = 42`
        );

        await expect(run(`node`, `./index.js`)).resolves.toMatchObject({
          code: 0,
          stdout: `{ default: 42 }\n`,
        });
      }
    )
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
      }
    )
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
      }
    )
  );
});
