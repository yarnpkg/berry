const {xfs} = require(`@yarnpkg/fslib`);
const {
  fs: {writeFile},
  tests: {setPackageWhitelist, startPackageServer, validLogins},
  yarn,
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
          `  - ${JSON.stringify(require.resolve(`@yarnpkg/monorepo/scripts/plugin-hello-world.js`))}`,
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

        const relativePluginPath = require.resolve(`@yarnpkg/monorepo/scripts/plugin-hello-world.js`);

        await writeFile(`${path}/.yarnrc.yml`, [
          `plugins:`,
          `  - ${await xfs.realpathPromise(relativePluginPath)}`,
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
          `  - path: ${JSON.stringify(require.resolve(`@yarnpkg/monorepo/scripts/plugin-hello-world.js`))}`,
          `    spec: "@yarnpkg/plugin-hello-world"`,
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
      `it should use the exact tag specified`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await expect(run(`dlx`, `-p`, `has-bin-entries`, `-p`, `no-deps-tags@rc`, `has-bin-entries`)).resolves.toMatchObject({
          stdout: expect.stringContaining(`no-deps-tags@npm:1.0.0-rc.1`),
        });
      }),
    );

    test(
      `it shouldn't warn on unused package extensions in projects created by dlx (dependencies)`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`various-requires`]: `1.0.0`,
          },
        },
        async ({path, run, source}) => {
          await yarn.writeConfiguration(path, {
            packageExtensions: {
              [`various-requires@*`]: {
                dependencies: {
                  [`no-deps`]: `1.0.0`,
                },
              },
            },
          });

          await expect(run(`dlx`, `has-bin-entries`)).resolves.toMatchObject({
            stdout: expect.not.stringContaining(`YN0068`),
          });
        },
      ),
    );

    test(
      `it shouldn't warn on unused package extensions in projects created by dlx (peerDependencies)`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`no-deps`]: `2.0.0`,
            [`various-requires`]: `1.0.0`,
          },
        },
        async ({path, run, source}) => {
          await yarn.writeConfiguration(path, {
            packageExtensions: {
              [`various-requires@*`]: {
                peerDependencies: {
                  [`no-deps`]: `*`,
                },
              },
            },
          });

          await expect(run(`dlx`, `has-bin-entries`)).resolves.toMatchObject({
            stdout: expect.not.stringContaining(`YN0068`),
          });
        },
      ),
    );

    test(
      `it shouldn't warn on unused package extensions in projects created by dlx (peerDependenciesMeta)`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`optional-peer-deps`]: `1.0.0`,
          },
        },
        async ({path, run, source}) => {
          await yarn.writeConfiguration(path, {
            packageExtensions: {
              [`optional-peer-deps@*`]: {
                peerDependenciesMeta: {
                  [`no-deps`]: {
                    optional: true,
                  },
                },
              },
            },
          });

          await expect(run(`dlx`, `has-bin-entries`)).resolves.toMatchObject({
            stdout: expect.not.stringContaining(`YN0068`),
          });
        },
      ),
    );
  });
});
