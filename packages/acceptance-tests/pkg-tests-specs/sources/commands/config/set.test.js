import {xfs} from '@yarnpkg/fslib';
import {EOL} from 'os';

describe(`Commands`, () => {
  describe(`config set`, () => {
    test(
      `it should print the configured value for the current directory`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await expect(run(`config`, `set`, `pnpShebang`, `#!/usr/bin/env iojs\n`)).resolves.toMatchObject({
          stdout: expect.stringContaining(`#!/usr/bin/env iojs\\n`),
        });

        await expect(xfs.readFilePromise(`${path}/.yarnrc.yml`, `utf8`)).resolves.toContain(`pnpShebang`);
      }),
    );

    test(
      `it shouldn't print secrets`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const {stdout} = await run(`config`, `set`, `npmAuthToken`, `foobar`);

        expect(stdout).not.toContain(`foobar`);
        expect(stdout).toContain(`********`);

        await expect(xfs.readFilePromise(`${path}/.yarnrc.yml`, `utf8`)).resolves.toContain(`npmAuthToken: foobar`);
      }),
    );

    test(
      `it should support setting JSON values`,
      makeTemporaryEnv({enableColors: false}, async({path, run, source}) => {
        const {stdout} = await run(`config`, `set`, `npmScopes.yarnpkg`, `--json`, JSON.stringify({
          npmAlwaysAuth: false,
        }));

        expect(stdout).toContain(`npmScopes.yarnpkg`);
        expect(stdout).toContain(`npmAlwaysAuth: false`);

        await expect(xfs.readFilePromise(`${path}/.yarnrc.yml`, `utf8`)).resolves.toContain(
          `npmScopes:${EOL}` +
          `  yarnpkg:${EOL}` +
          `    npmAlwaysAuth: false`,
        );
      }),
    );
  });
});
