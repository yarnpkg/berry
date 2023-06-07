import {Filename, PortablePath, ppath, xfs} from '@yarnpkg/fslib';

describe(`Features`, () => {
  describe(`Configuration`, () => {
    test(`it should let the project configuration override the home configuration`, makeTemporaryEnv({
    }, async ({path, run, source}) => {
      await xfs.mkdirPromise(ppath.join(path, `..`), {recursive: true});

      await xfs.writeJsonPromise(ppath.join(path, `..`, Filename.rc), {
        preferInteractive: true,
      });

      // Sanity check
      await expect(run(`config`, `get`, `--json`, `preferInteractive`)).resolves.toMatchObject({
        stdout: `true\n`,
      });

      await xfs.writeJsonPromise(ppath.join(path, Filename.rc), {
        preferInteractive: false,
      });

      await expect(run(`config`, `get`, `--json`, `preferInteractive`)).resolves.toMatchObject({
        stdout: `false\n`,
      });
    }));

    test(`it should let the env configuration override the project configuration`, makeTemporaryEnv({
    }, async ({path, run, source}) => {
      await xfs.writeJsonPromise(ppath.join(path, Filename.rc), {
        preferInteractive: true,
      });

      // Sanity check
      await expect(run(`config`, `get`, `--json`, `preferInteractive`)).resolves.toMatchObject({
        stdout: `true\n`,
      });

      await expect(run(`config`, `get`, `--json`, `preferInteractive`, {
        env: {YARN_PREFER_INTERACTIVE: `0`},
      })).resolves.toMatchObject({
        stdout: `false\n`,
      });
    }));

    test(`it should skip the home configuration if onConflict: reset is set in the project configuration`, makeTemporaryEnv({
    }, async ({path, run, source}) => {
      await xfs.mkdirPromise(ppath.join(path, `..`), {recursive: true});

      // Sanity checks
      await expect(run(`config`, `get`, `--json`, `preferInteractive`)).resolves.toMatchObject({stdout: `false\n`});
      await expect(run(`config`, `get`, `--json`, `preferTruncatedLines`)).resolves.toMatchObject({stdout: `false\n`});

      await xfs.writeJsonPromise(ppath.join(path, `..`, Filename.rc), {
        preferInteractive: true,
        preferTruncatedLines: true,
      });

      await expect(run(`config`, `get`, `--json`, `preferInteractive`)).resolves.toMatchObject({stdout: `true\n`});
      await expect(run(`config`, `get`, `--json`, `preferTruncatedLines`)).resolves.toMatchObject({stdout: `true\n`});

      await xfs.writeJsonPromise(ppath.join(path, Filename.rc), {
        onConflict: `reset`,
        preferInteractive: true,
      });

      await expect(run(`config`, `get`, `--json`, `preferInteractive`)).resolves.toMatchObject({stdout: `true\n`});
      await expect(run(`config`, `get`, `--json`, `preferTruncatedLines`)).resolves.toMatchObject({stdout: `false\n`});

      await xfs.writeJsonPromise(ppath.join(path, Filename.rc), {
        onConflict: `reset`,
      });

      await expect(run(`config`, `get`, `--json`, `preferInteractive`)).resolves.toMatchObject({stdout: `false\n`});
      await expect(run(`config`, `get`, `--json`, `preferTruncatedLines`)).resolves.toMatchObject({stdout: `false\n`});
    }));

    test(`it should allow extending values from the home configuration if explicitly requested`, makeTemporaryEnv({
    }, async ({path, run, source}) => {
      await xfs.mkdirPromise(ppath.join(path, `..`), {recursive: true});

      // Sanity checks
      await expect(run(`config`, `get`, `--json`, `preferInteractive`)).resolves.toMatchObject({stdout: `false\n`});
      await expect(run(`config`, `get`, `--json`, `immutablePatterns`)).resolves.toMatchObject({stdout: `[]\n`});

      await xfs.writeJsonPromise(ppath.join(path, `..`, Filename.rc), {
        preferInteractive: true,
        immutablePatterns: [`foo`],
      });

      await expect(run(`config`, `get`, `--json`, `preferInteractive`)).resolves.toMatchObject({stdout: `true\n`});
      await expect(run(`config`, `get`, `--json`, `immutablePatterns`)).resolves.toMatchObject({stdout: `["foo"]\n`});

      await xfs.writeJsonPromise(ppath.join(path, Filename.rc), {
        onConflict: `reset`,
        immutablePatterns: [`bar`],
      });

      await expect(run(`config`, `get`, `--json`, `preferInteractive`)).resolves.toMatchObject({stdout: `false\n`});
      await expect(run(`config`, `get`, `--json`, `immutablePatterns`)).resolves.toMatchObject({stdout: `["bar"]\n`});

      await xfs.writeJsonPromise(ppath.join(path, Filename.rc), {
        onConflict: `reset`,
        immutablePatterns: {
          onConflict: `extend`,
          value: [`bar`],
        },
      });

      await expect(run(`config`, `get`, `--json`, `preferInteractive`)).resolves.toMatchObject({stdout: `false\n`});
      await expect(run(`config`, `get`, `--json`, `immutablePatterns`)).resolves.toMatchObject({stdout: `["foo","bar"]\n`});
    }));

    test(`it should return a helpful error if the rc file is wrong`, makeTemporaryEnv({
    }, async ({path, run, source}) => {
      await xfs.mkdirPromise(ppath.join(path, `..` as PortablePath), {recursive: true});

      await xfs.writeJsonPromise(ppath.join(path, `..` as PortablePath, Filename.rc), {
        packageExtensions: {
          "@lezer/html@*": {
            dependencies: {
              "@lezer/common": `*`,
              // Wrong indentation here, will throw an error:
              "@lezer/javascript@*": {
                dependencies: {
                  "@lezer/common": `*`,
                },
              },
            },
          },
        },
      });

      // https://github.com/yarnpkg/berry/pull/5213
      await expect(run(`config`, `get`, `--json`, `packageExtensions`)).rejects.toMatchObject({stdout: expect.stringContaining(`Internal Error: Expected configuration setting "packageExtensions['@lezer/html@*'].dependencies['@lezer/javascript@*']" to be a string, got object`)});
    }));
  });
});
