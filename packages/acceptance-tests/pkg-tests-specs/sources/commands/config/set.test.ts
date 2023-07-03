import {Filename, ppath, xfs} from '@yarnpkg/fslib';
import {parseSyml}            from '@yarnpkg/parsers';
import {EOL}                  from 'os';

describe(`Commands`, () => {
  describe(`config set`, () => {
    test(
      `it shouldn't remove empty arrays from the files`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await xfs.writeJsonPromise(ppath.join(path, Filename.rc), {
          injectEnvironmentFiles: [],
        });

        await run(`config`, `set`, `pnpShebang`, `#!/usr/bin/env iojs\n`);

        expect(parseSyml(await xfs.readFilePromise(ppath.join(path, Filename.rc), `utf8`))).toMatchObject({
          injectEnvironmentFiles: [],
        });
      }),
    );

    test(
      `it should print the configured value for the current directory`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await expect(run(`config`, `set`, `pnpShebang`, `#!/usr/bin/env iojs\n`)).resolves.toMatchObject({
          stdout: expect.stringContaining(`#!/usr/bin/env iojs\\n`),
        });

        await expect(xfs.readFilePromise(ppath.join(path, Filename.rc), `utf8`)).resolves.toContain(`pnpShebang`);
      }),
    );

    test(
      `it shouldn't print secrets`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const {stdout} = await run(`config`, `set`, `npmAuthToken`, `foobar`);

        expect(stdout).not.toContain(`foobar`);
        expect(stdout).toContain(`********`);

        await expect(xfs.readFilePromise(ppath.join(path, Filename.rc), `utf8`)).resolves.toContain(`npmAuthToken: foobar`);
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

        await expect(xfs.readFilePromise(ppath.join(path, Filename.rc), `utf8`)).resolves.toContain(
          `npmScopes:${EOL}` +
          `  yarnpkg:${EOL}` +
          `    npmAlwaysAuth: false`,
        );
      }),
    );

    test(
      `it should allow running the command from arbitrary folders if the -H,--home option is set`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const tmpDir = await xfs.mktempPromise();

        await expect(run(`config`, `set`, `--home`, `pnpShebang`, `#!/usr/bin/env iojs\n`, {cwd: tmpDir})).resolves.toMatchObject({
          code: 0,
        });
      }),
    );
  });
});
