import {xfs} from '@yarnpkg/fslib';

describe(`Commands`, () => {
  describe(`config unset`, () => {
    test(
      `it should unset a simple config correctly`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await run(`config`, `set`, `pnpShebang`, `#!/usr/bin/env iojs\n`);
        await expect(xfs.readFilePromise(`${path}/.yarnrc.yml`, `utf8`)).resolves.toContain(`pnpShebang`);
        await expect(run(`config`, `unset`, `pnpShebang`)).resolves.toMatchObject({
          stdout: expect.stringContaining(`Successfully unset`),
        });
        await expect(xfs.readFilePromise(`${path}/.yarnrc.yml`, `utf8`)).resolves.toStrictEqual(``);
      }),
    );

    test(
      `it should unset a complex config correctly`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await run(`config`, `set`, `npmScopes.yarnpkg`, `--json`, JSON.stringify({
          npmAlwaysAuth: false,
        }));
        await expect(xfs.readFilePromise(`${path}/.yarnrc.yml`, `utf8`)).resolves.toContain(`npmScopes`);
        await expect(run(`config`, `unset`, `npmScopes`)).resolves.toMatchObject({
          stdout: expect.stringContaining(`Successfully unset`),
        });
        await expect(xfs.readFilePromise(`${path}/.yarnrc.yml`, `utf8`)).resolves.toStrictEqual(``);
      }),
    );

    test(
      `it should unset a nested config correctly`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await run(`config`, `set`, `npmScopes.yarnpkg`, `--json`, JSON.stringify({
          npmRegistryServer: `https://registry.yarnpkg.com`,
          npmAlwaysAuth: false,
        }));
        await expect(xfs.readFilePromise(`${path}/.yarnrc.yml`, `utf8`)).resolves.toContain(`npmScopes`);
        await expect(run(`config`, `unset`, `npmScopes.yarnpkg.npmAlwaysAuth`)).resolves.toMatchObject({
          stdout: expect.stringContaining(`Successfully unset`),
        });
        await expect(xfs.readFilePromise(`${path}/.yarnrc.yml`, `utf8`)).resolves.toContain(`npmScopes`);
        await expect(xfs.readFilePromise(`${path}/.yarnrc.yml`, `utf8`)).resolves.toContain(`npmRegistryServer`);
        await expect(xfs.readFilePromise(`${path}/.yarnrc.yml`, `utf8`)).resolves.not.toContain(`npmAlwaysAuth`);
      }),
    );

    test(
      `it should allow running the command from arbitrary folders if the -H,--home option is set`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const tmpDir = await xfs.mktempPromise();

        await expect(run(`config`, `unset`, `--home`, `pnpShebang`, {cwd: tmpDir})).resolves.toMatchObject({
          code: 0,
        });
      }),
    );
  });
});
