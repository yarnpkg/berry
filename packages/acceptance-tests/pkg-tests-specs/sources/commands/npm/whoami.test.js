const {
  fs: {writeFile},
  tests: {startPackageServer, validLogins},
} = require(`pkg-tests-core`);

const INVALID_AUTH_TOKEN = `a24cb960-e6a5-45fc-b9ab-0f9fe0aaae57`;
const INVALID_AUTH_IDENT = `dXNlcm5hbWU6bm90IHRoZSByaWdodCBwYXNzd29yZA==`; // username:not the right password

describe(`Commands`, () => {
  describe(`npm whoami`, () => {
    test(
      `it should print the npm registry username when config has a valid npmAuthToken`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await writeFile(`${path}/.yarnrc.yml`, `npmAuthToken: "${validLogins.fooUser.npmAuthToken}"\n`);

        let code;
        let stdout;
        let stderr;

        try {
          ({code, stdout, stderr} = await run(`npm`, `whoami`));
        } catch (error) {
          ({code, stdout, stderr} = error);
        }

        expect({code, stdout, stderr}).toMatchSnapshot();
      }),
    );

    test(
      `it should print the npm registry username when config has a valid npmAuthIdent`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await writeFile(`${path}/.yarnrc.yml`, `npmAuthIdent: "${validLogins.fooUser.npmAuthIdent.encoded}"\n`);

        let code;
        let stdout;
        let stderr;

        try {
          ({code, stdout, stderr} = await run(`npm`, `whoami`));
        } catch (error) {
          ({code, stdout, stderr} = error);
        }

        expect({code, stdout, stderr}).toMatchSnapshot();
      }),
    );

    test(
      `it should print the npm registry username for a given scope`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const url = await startPackageServer();

        await writeFile(`${path}/.yarnrc.yml`, [
          `npmRegistryServer: "${url}"\n`,
          `npmAuthToken: "${validLogins.fooUser.npmAuthToken}"\n`,
          `npmScopes:\n`,
          `  testScope:\n`,
          `    npmAuthToken: ${validLogins.barUser.npmAuthToken}\n`,
          `    npmRegistryServer: "${url}"\n`,
        ].join(``));

        let code;
        let stdout;
        let stderr;

        try {
          ({code, stdout, stderr} = await run(`npm`, `whoami`, `--scope`, `testScope`));
        } catch (error) {
          ({code, stdout, stderr} = error);
        }

        expect({code, stdout, stderr}).toMatchSnapshot();
      }),
    );

    test(
      `it should throw an error when no auth config is found`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await expect(run(`npm`, `whoami`)).rejects.toThrowError(/No authentication configured/);
      }),
    );

    test(
      `it should throw an error when config has an invalid npmAuthToken`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await writeFile(`${path}/.yarnrc.yml`, `npmAuthToken: "${INVALID_AUTH_TOKEN}"\n`);
        await expect(run(`npm`, `whoami`)).rejects.toThrowError(/Invalid authentication \(as an unknown user\)/);
      }),
    );

    test(
      `it should throw an error when config has an invalid npmAuthIdent`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await writeFile(`${path}/.yarnrc.yml`, `npmAuthIdent: "${INVALID_AUTH_IDENT}"\n`);
        await expect(run(`npm`, `whoami`)).rejects.toThrowError(/Invalid authentication \(as an unknown user\)/);
      }),
    );

    test(
      `it should thow an error when invalid auth config is found for a scope`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const url = await startPackageServer();

        await writeFile(`${path}/.yarnrc.yml`, [
          `npmScopes:\n`,
          `  testScope:\n`,
          `    npmRegistryServer: "${url}"\n`,
          `npmRegistries:\n`,
          `  "${url}":\n`,
          `    npmAuthToken: ${INVALID_AUTH_TOKEN}`,
        ].join(``));

        await expect(run(`npm`, `whoami`, `--scope`, `testScope`)).rejects.toThrowError(/Invalid authentication \(as an unknown user\)/);
        await expect(run(`npm`, `whoami`)).rejects.toThrowError(/Invalid authentication \(as an unknown user\)/);
      }),
    );
  });
});
