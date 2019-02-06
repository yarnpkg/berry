const {
  fs: {readJson},
} = require('pkg-tests-core');

describe(`Commands`, () => {
  describe(`add`, () => {
    test(
      `it should add a new regular dependency to the current project (explicit semver)`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await run(`add`, `no-deps@1.0.0`);

        await expect(readJson(`${path}/package.json`)).resolves.toMatchObject({
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

        await expect(readJson(`${path}/package.json`)).resolves.toMatchObject({
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

        await expect(readJson(`${path}/package.json`)).resolves.toMatchObject({
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

        await expect(readJson(`${path}/package.json`)).resolves.toMatchObject({
          dependencies: {
            [`no-deps`]: `2.0.0`,
          },
        });
      }),
    );

    test(
      `it should add a new development dependency to the current project`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await run(`add`, `no-deps`, `-D`);

        await expect(readJson(`${path}/package.json`)).resolves.toMatchObject({
          devDependencies: {
            [`no-deps`]: `^2.0.0`,
          },
        });
      }),
    );

    test(
      `it should add a new peer dependency to the current project`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await run(`add`, `no-deps`, `-P`);

        await expect(readJson(`${path}/package.json`)).resolves.toMatchObject({
          peerDependencies: {
            [`no-deps`]: `*`,
          },
        });
      }),
    );
  });
});
