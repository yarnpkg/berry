const {npath, xfs} = require(`@yarnpkg/fslib`);
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
        await xfs.mkdirPromise(`${path}/foo/bar/baz`, {recursive: true});
        await run(`install`);

        expect((await run(`--cwd`, `./foo`, `exec`, `pwd`)).stdout).toBe(`${npath.fromPortablePath(`${path}/foo`)}\n`);
        expect((await run(`--cwd=./foo/bar`, `exec`, `pwd`)).stdout).toBe(`${npath.fromPortablePath(`${path}/foo/bar`)}\n`);
        expect((await run(`--cwd`, `./baz`, `--cwd`, `./bar`, `--cwd`, `./foo`, `exec`, `pwd`)).stdout).toBe(`${npath.fromPortablePath(`${path}/foo/bar/baz`)}\n`);
      }),
    );
  });
});
