const semver = require('semver');

describe(`Entry`, () => {
  describe(`version option`, () => {

    test(
      `it should print the version from the package.json when given --version`,
       makeTemporaryEnv({}, async ({path, run, source}) => {
        const {stdout} = await run(`--version`);
        const [prefix, version] = stdout.replace("\n", "").split("v")
        expect(semver.valid(version)).toBeTruthy()
      }),
    );

    test(
      `it should print the version from the package.json when given -v`,
       makeTemporaryEnv({}, async ({path, run, source}) => {
        const {stdout} = await run(`-v`);
        const [prefix, version] = stdout.replace("\n", "").split("v")
        expect(semver.valid(version)).toBeTruthy()
      }),
    );

  });
});
