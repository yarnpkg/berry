const {xfs} = require(`@yarnpkg/fslib`);
const semver = require(`semver`);

describe(`Entry`, () => {
  describe(`version option`, () => {
    test(
      `it should print the version from the package.json when given --version`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const {stdout} = await run(`--version`);
        expect(semver.valid(stdout.trim())).toBeTruthy();
      }),
    );

    test(
      `it should print the version from the package.json when given -v`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const {stdout} = await run(`-v`);
        expect(semver.valid(stdout.trim())).toBeTruthy();
      }),
    );
  });

  describe(`cwd option`, () => {
    test(
      `it should support relative paths`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await xfs.mkdirPromise(`${path}/foo`);
        await expect(run(`--cwd`, `./foo`, `-v`)).resolves.not.toThrow();
      }),
    );
  });
});
