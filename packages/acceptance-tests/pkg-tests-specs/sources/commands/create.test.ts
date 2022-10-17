import {xfs, ppath, Filename} from '@yarnpkg/fslib';

describe(`Commands`, () => {
  describe(`create`, () => {
    test(
      `it should generate \`hello.txt\` correctly using a starter-kit-package`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await run(`create`, `-q`, `test-app`);
        expect(xfs.readFileSync(ppath.join(path, `hello.txt` as Filename), `utf8`)).toEqual(`Hello World`);
      }),
    );

    test(
      `it should generate \`hello.txt\` correctly using a scoped starter-kit-package`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await run(`create`, `-q`, `@scoped/test-app`);
        expect(xfs.readFileSync(ppath.join(path, `hello.txt` as Filename), `utf8`)).toEqual(`Hello World`);
      }),
    );

    test(
      `it should treat '@scope' as '@scope/create'`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await expect(run(`create`, `@404-scope`)).rejects.toMatchObject({
          code: 1,
          stdout: expect.stringContaining(`@404-scope/create@unknown`),
        });
      }),
    );

    test(
      `it should treat '@scope@next' as '@scope/create@next'`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await expect(run(`create`, `@404-scope@next`)).rejects.toMatchObject({
          code: 1,
          stdout: expect.stringContaining(`@404-scope/create@npm:next`),
        });
      }),
    );

    test(
      `it should treat '@scope/app' as '@scope/create-app'`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await expect(run(`create`, `@404-scope/app`)).rejects.toMatchObject({
          code: 1,
          stdout: expect.stringContaining(`@404-scope/create-app@unknown`),
        });
      }),
    );
  });
});
