const {
  fs: {readJson},
} = require('pkg-tests-core');

describe(`Commands`, () => {
  describe(`add`, () => {
    test(
      `it should add a new regular dependency to the current project (explicit semver)`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await run(`add`, `no-deps@1.0.0`);

        expect(await readJson(`${path}/package.json`)).toMatchObject({
          dependencies: {
            [`no-deps`]: `1.0.0`,
          },
        });
      }),
    );

    test(
      `it should add a new regular dependency to the current project (implicit caret)`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await run(`add`, `no-deps`);

        expect(await readJson(`${path}/package.json`)).toMatchObject({
          dependencies: {
            [`no-deps`]: `^2.0.0`,
          },
        });
      }),
    );

    test(
      `it should add a new regular dependency to the current project (implicit tilde)`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await run(`add`, `no-deps`, `-T`);

        expect(await readJson(`${path}/package.json`)).toMatchObject({
          dependencies: {
            [`no-deps`]: `~2.0.0`,
          },
        });
      }),
    );

    test(
      `it should add a new regular dependency to the current project (implicit exact)`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await run(`add`, `no-deps`, `-E`);

        expect(await readJson(`${path}/package.json`)).toMatchObject({
          dependencies: {
            [`no-deps`]: `2.0.0`,
          },
        });
      }),
    );
  });
});
