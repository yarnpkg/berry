import {tests} from 'pkg-tests-core';

const npmInfo = async (run: tests.Run, ...args: Array<string>) => {
  const {stdout} = await run(`npm`, `info`, `--json`, ...args);

  return JSON.parse(stdout);
};

describe(`Commands`, () => {
  describe(`npm info`, () => {
    test(
      `it should return information about the latest version of a package if no range is specified`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await expect(npmInfo(run, `no-deps`)).resolves.toMatchObject({
          version: `2.0.0`,
        });
      }),
    );

    test(
      `it should return information about a specific version if requested`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await expect(npmInfo(run, `no-deps@1.0.0`)).resolves.toMatchObject({
          version: `1.0.0`,
        });
      }),
    );

    test(
      `it should return information about the highest version that satisfies a range`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await expect(npmInfo(run, `no-deps@^1.0.0`)).resolves.toMatchObject({
          version: `1.1.0`,
        });
      }),
    );

    test(
      `it should return information about a tagged version if requested`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await expect(npmInfo(run, `no-deps-tags@rc`)).resolves.toMatchObject({
          version: `1.0.0-rc.1`,
        });
      }),
    );
  });
});
