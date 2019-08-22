const {
  fs: {readJson},
  exec: {execFile},
} = require('pkg-tests-core');

describe(`Commands`, () => {
  describe(`version check`, () => {
    test(
      `it shouldn't work if the strategy isn't semver and there is no prior version`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await expect(run(`version`, `patch`)).rejects.toThrow();
      }),
    );

    test(
      `it should increase the version number for a workspace`,
      makeTemporaryEnv({
        version: `0.0.0`,
      }, async ({path, run, source}) => {
        await run(`version`, `patch`);

        await expect(readJson(`${path}/package.json`)).resolves.toMatchObject({
          version: `0.0.1`,
        });
      }),
    );
  });
});
