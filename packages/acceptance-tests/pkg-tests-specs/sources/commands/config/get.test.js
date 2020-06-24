import {npath, xfs} from '@yarnpkg/fslib';

describe(`Commands`, () => {
  describe(`config get`, () => {
    test(
      `it should print the requested configuration value for the current directory`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await expect(run(`config`, `get`, `pnpShebang`)).resolves.toMatchObject({
          stdout: `#!/usr/bin/env node\n`,
        });
      }),
    );

    test(
      `it shouldn't print secrets by default`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await xfs.writeFilePromise(`${path}/.yarnrc.yml`, `npmAuthToken: foobar\n`);

        await expect(run(`config`, `get`, `npmAuthToken`)).resolves.toMatchObject({
          stdout: `********\n`,
        });
      }),
    );

    test(
      `it should print secrets when using the --no-redacted flag`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await xfs.writeFilePromise(`${path}/.yarnrc.yml`, `npmAuthToken: foobar\n`);

        await expect(run(`config`, `get`, `npmAuthToken`, `--no-redacted`)).resolves.toMatchObject({
          stdout: `foobar\n`,
        });
      }),
    );

    test(
      `it should print native paths`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const {stdout} = await run(`config`, `get`, `cacheFolder`, `--no-redacted`);
        const value = stdout.trim();

        expect(value).toEqual(npath.fromPortablePath(value));
      }),
    );

    test(
      `it should support printing sub-keys`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await xfs.writeFilePromise(`${path}/.yarnrc.yml`, `packageExtensions:\n  "foo@*":\n    dependencies:\n      "bar": "1.0.0"\n`);

        await expect(run(`config`, `get`, `packageExtensions["foo@*"].dependencies["bar"]`)).resolves.toMatchObject({
          stdout: `1.0.0\n`,
        });
      }),
    );
  });
});
