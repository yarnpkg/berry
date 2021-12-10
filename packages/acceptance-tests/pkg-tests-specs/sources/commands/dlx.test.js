const {
  fs: {writeFile, realpath},
  tests: {setPackageWhitelist, startPackageServer, validLogins},
} = require(`pkg-tests-core`);

describe(`Commands`, () => {
  describe(`dlx`, () => {
    test(
      `it should run the specified binary`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await expect(run(`dlx`, `-q`, `has-bin-entries`)).resolves.toMatchObject({
          stdout: ``,
        });
      }),
    );

    test(
      `it should forward the arguments to the binary`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await expect(run(`dlx`, `-q`, `has-bin-entries`, `--foo`, `hello`, `world`)).resolves.toMatchObject({
          stdout: `--foo\nhello\nworld\n`,
        });
      }),
    );

    test(
      `it should return the exit code from the binary`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await expect(run(`dlx`, `-q`, `-p`, `has-bin-entries`, `has-bin-entries-with-exit-code`, `42`)).rejects.toMatchObject({
          code: 42,
        });
      }),
    );

    test(
      `it should support running different binaries than the default one`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await expect(run(`dlx`, `-q`, `-p`, `has-bin-entries`, `has-bin-entries-with-relative-require`)).resolves.toMatchObject({
          // Note: must be updated if you add further versions of "has-bin-entries", since it will always use the latest unless specified otherwise
          stdout: `2.0.0\n`,
        });
      }),
    );

    test(
      `it should support running arbitrary versions`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await expect(run(`dlx`, `-q`, `-p`, `has-bin-entries@1.0.0`, `has-bin-entries-with-relative-require`)).resolves.toMatchObject({
          stdout: `1.0.0\n`,
        });
      }),
    );

    test(
      `it should always update the binary between two calls`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await setPackageWhitelist(new Map([[`has-bin-entries`, new Set([`1.0.0`])]]), async () => {
          await expect(run(`dlx`, `-q`, `-p`, `has-bin-entries`, `has-bin-entries-with-relative-require`)).resolves.toMatchObject({
            stdout: `1.0.0\n`,
          });
        });
        await setPackageWhitelist(new Map([[`has-bin-entries`, new Set([`1.0.0`, `2.0.0`])]]), async () => {
          await expect(run(`dlx`, `-q`, `-p`, `has-bin-entries`, `has-bin-entries-with-relative-require`)).resolves.toMatchObject({
            stdout: `2.0.0\n`,
          });
        });
      }),
    );

    test(
      `it should respect locally configured registry scopes`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const url = await startPackageServer();

        await writeFile(`${path}/.yarnrc.yml`, [
          `npmScopes:`,
          `  private:`,
          `    npmRegistryServer: "${url}"`,
          `    npmAuthToken: ${validLogins.fooUser.npmAuthToken}`,
        ].join(`\n`));

        await expect(run(`dlx`, `-q`, `@private/has-bin-entry`)).resolves.toMatchObject({
          stdout: `1.0.0\n`,
        });
      }),
    );

    test(
      `it should not fail when plugins are locally enabled using a string entry with a relative path`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const url = await startPackageServer();

        await writeFile(`${path}/.yarnrc.yml`, [
          `plugins:`,
          `  - ${JSON.stringify(require.resolve(`@yarnpkg/monorepo/scripts/plugin-version.js`))}`,
          `npmScopes:`,
          `  private:`,
          `    npmRegistryServer: "${url}"`,
          `    npmAuthToken: ${validLogins.fooUser.npmAuthToken}`,
          `preferDeferredVersions: true`,
        ].join(`\n`));

        await expect(run(`dlx`, `-q`, `@private/has-bin-entry`)).resolves.toMatchObject({
          stdout: `1.0.0\n`,
        });
      }),
    );

    test(
      `it should not fail when plugins are locally enabled using a string entry with an absolute path`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const url = await startPackageServer();

        const relativePluginPath = require.resolve(`@yarnpkg/monorepo/scripts/plugin-version.js`);

        await writeFile(`${path}/.yarnrc.yml`, [
          `plugins:`,
          `  - ${await realpath(relativePluginPath)}`,
          `npmScopes:`,
          `  private:`,
          `    npmRegistryServer: "${url}"`,
          `    npmAuthToken: ${validLogins.fooUser.npmAuthToken}`,
          `preferDeferredVersions: true`,
        ].join(`\n`));

        await expect(run(`dlx`, `-q`, `@private/has-bin-entry`)).resolves.toMatchObject({
          stdout: `1.0.0\n`,
        });
      }),
    );

    test(
      `it should not fail when plugins are locally enabled using an object entry`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const url = await startPackageServer();

        await writeFile(`${path}/.yarnrc.yml`, [
          `plugins:`,
          `  - path: ${JSON.stringify(require.resolve(`@yarnpkg/monorepo/scripts/plugin-version.js`))}`,
          `    spec: "@yarnpkg/plugin-version"`,
          `npmScopes:`,
          `  private:`,
          `    npmRegistryServer: "${url}"`,
          `    npmAuthToken: ${validLogins.fooUser.npmAuthToken}`,
          `preferDeferredVersions: true`,
        ].join(`\n`));

        await expect(run(`dlx`, `-q`, `@private/has-bin-entry`)).resolves.toMatchObject({
          stdout: `1.0.0\n`,
        });
      }),
    );
  });
});
