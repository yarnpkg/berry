const {join} = require(`path`);
const {xfs} = require(`@yarnpkg/fslib`);

describe(`Commands`, () => {
  describe(`create`, () => {
    test(
      `it should generate \`hello.txt\` correctly using a starter-kit-package`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await run(`create`, `-q`, `test-app`);
        expect(xfs.readFileSync(join(path, `hello.txt`), `utf8`)).toEqual(`Hello World`);
      }),
    );

    test(
      `it should generate \`hello.txt\` correctly using a scoped starter-kit-package`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await run(`create`, `-q`, `@scoped/test-app`);
        expect(xfs.readFileSync(join(path, `hello.txt`), `utf8`)).toEqual(`Hello World`);
      }),
    );
  });
});
