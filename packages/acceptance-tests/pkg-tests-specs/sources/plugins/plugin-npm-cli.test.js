const {
  fs: {createTemporaryFolder, readFile, writeFile},
  tests: {startPackageServer}
} = require('pkg-tests-core');

const AUTH_TOKEN = `686159dc-64b3-413e-a244-2de2b8d1c36f`;
const AUTH_IDENT = `dXNlcm5hbWU6YSB2ZXJ5IHNlY3VyZSBwYXNzd29yZA==`;

const INVALID_AUTH_TOKEN = `a24cb960-e6a5-45fc-b9ab-0f9fe0aaae57`;
const INVALID_AUTH_IDENT = `dXNlcm5hbWU6bm90IHRoZSByaWdodCBwYXNzd29yZA==`; // username:not the right password

const RC_FILENAME = `.spec-yarnrc`;
const FAKE_REGISTRY_URL = `http://yarn.test.registry`;

describe(`Plugins`, () => {
  describe(`npm-cli whoami`, () => {
    test(
      `should print the npm registry username when config has a valid npmAuthToken`,
      makeTemporaryEnv({}, async ({ path, run, source }) => {
        await writeFile(`${path}/.yarnrc`, `npmAuthToken "${AUTH_TOKEN}"\n`);

        let code;
        let stdout;
        let stderr;

        try {
          ({code, stdout, stderr} = await run(`npm`, `whoami`));
        } catch (error) {
          ({code, stdout, stderr} = error);
        }

        expect({code, stdout, stderr}).toMatchSnapshot();
      })
    );

    test(
      `should print the npm registry username when config has a valid npmAuthIdent`,
      makeTemporaryEnv({}, async ({ path, run, source }) => {
        await writeFile(`${path}/.yarnrc`, `npmAuthIdent "${AUTH_IDENT}"\n`);

        let code;
        let stdout;
        let stderr;

        try {
          ({code, stdout, stderr} = await run(`npm`, `whoami`));
        } catch (error) {
          ({code, stdout, stderr} = error);
        }

        expect({code, stdout, stderr}).toMatchSnapshot();
      })
    );

    test(
      `should print the npm registry username for a given scope`,
      makeTemporaryEnv({}, async ({ path, run, source }) => {
        const url = startPackageServer();
        const rcFileContent = [
          `npmScopes:\n`,
          `  testScope:\n`,
          `    npmRegistryServer: "${url}"\n`,
          `npmRegistries:\n`,
          `  "${url}":\n`,
          `    npmAuthToken: ${AUTH_TOKEN}`,
        ].join(``);

        await writeFile(`${path}/.yarnrc`, rcFileContent);

        let code;
        let stdout;
        let stderr;

        try {
          ({code, stdout, stderr} = await run(`npm`, `whoami`, `--scope`, `testScope`));
        } catch (error) {
          ({code, stdout, stderr} = error);
        }

        expect({code, stdout, stderr}).toMatchSnapshot();
      })
    );

    test(
      `should throw an error when no auth config is found`,
      makeTemporaryEnv({}, async ({ path, run, source }) => {
        await expect(run(`npm`, `whoami`)).rejects.toThrowError(/No authentication configured/);
      })
    );

    test(
      `should throw an error when config has an invalid npmAuthToken`,
      makeTemporaryEnv({}, async ({ path, run, source }) => {
        await writeFile(`${path}/.yarnrc`, `npmAuthToken "${INVALID_AUTH_TOKEN}"\n`);
        await expect(run(`npm`, `whoami`)).rejects.toThrowError(/Authentication failed/);
      })
    );

    test(
      `should throw an error when config has an invalid npmAuthIdent`,
      makeTemporaryEnv({}, async ({ path, run, source }) => {
        await writeFile(`${path}/.yarnrc`, `npmAuthIdent "${INVALID_AUTH_IDENT}"\n`);
        await expect(run(`npm`, `whoami`)).rejects.toThrowError(/Authentication failed/);
      })
    );

    test(
      `should thow an error when invalid auth config is found for a scope`,
      makeTemporaryEnv({}, async ({ path, run, source }) => {
        const url = startPackageServer();
        const rcFileContent = [
          `npmScopes:\n`,
          `  testScope:\n`,
          `    npmRegistryServer: "${url}"\n`,
          `npmRegistries:\n`,
          `  "${url}":\n`,
          `    npmAuthToken: ${INVALID_AUTH_TOKEN}`,
        ].join(``);

        await writeFile(`${path}/.yarnrc`, rcFileContent);
        await expect(run(`npm`, `whoami`, `--scope`, `testScope`)).rejects.toThrowError(/Authentication failed/);
        await expect(run(`npm`, `whoami`)).rejects.toThrowError(/Authentication failed/);
      })
    );
  });

  describe(`npm-cli login`, () => {
    test(
      `should login a user with no OTP setup`,
      makeTemporaryEnv({}, async ({ path, run, source }) => {
        const homePath = await createTemporaryFolder();
        await writeFile(`${homePath}/${RC_FILENAME}`, `init-scope: berry-test\n`);

        let code;
        let stdout;
        let stderr;

        try {
          ({ code, stdout, stderr } = await run(`npm`, `login`, {
            env: {
              HOME: homePath,
              USERPROFILE: homePath,
              TEST_NPM_USER: `anotherTestUser`,
              TEST_NPM_PASSWORD: `password123`,
              YARN_RC_FILENAME: RC_FILENAME
            }
          }));
        } catch (error) {
          ({ code, stdout, stderr } = error);
        }

        const rcFileContent = await readFile(`${homePath}/${RC_FILENAME}`);

        expect(rcFileContent.toString()).toMatchSnapshot();
        expect({code, stdout, stderr}).toMatchSnapshot();
      })
    );

    test(
      `should login a user with OTP setup`,
      makeTemporaryEnv({}, async ({ path, run, source }) => {
        const homePath = await createTemporaryFolder();
        await writeFile(`${homePath}/${RC_FILENAME}`, `init-scope berry-test\n`);

        let code;
        let stdout;
        let stderr;

        try {
          ({ code, stdout, stderr } = await run(`npm`, `login`, {
            env: {
              HOME: homePath,
              USERPROFILE: homePath,
              TEST_NPM_USER: `testUser`,
              TEST_NPM_PASSWORD: `password`,
              TEST_NPM_2FA_TOKEN: `1234`,
              YARN_RC_FILENAME: RC_FILENAME
            }
          }));
        } catch (error) {
          ({code, stdout, stderr} = error);
        }

        const rcFileContent = await readFile(`${homePath}/${RC_FILENAME}`);

        expect(rcFileContent.toString()).toMatchSnapshot();
        expect({code, stdout, stderr}).toMatchSnapshot();
      })
    );

    test(
      `should throw an error when credentials are incorrect`,
      makeTemporaryEnv({}, async ({ path, run, source }) => {
        await expect(
          run(`npm`, `login`, {
            env: {
              TEST_NPM_USER: `anotherTestUser`,
              TEST_NPM_PASSWORD: `incorrect password`
            }
          })
        ).rejects.toThrowError(/Invalid Authentication/);
      })
    );

    test(
      `should throw an error with incorrect OTP`,
      makeTemporaryEnv({}, async ({ path, run, source }) => {
        await expect(
          run(`npm`, `login`, {
            env: {
              TEST_NPM_USER: `testUser`,
              TEST_NPM_PASSWORD: `password`,
              TEST_NPM_2FA_TOKEN: `incorrect OTP`,
            }
          })
        ).rejects.toThrowError(/Invalid Authentication/);
      })
    );

    test(
      `should login a user with no OTP setup to a specific scope`,
      makeTemporaryEnv({}, async ({ path, run, source }) => {
        const url = startPackageServer();
        const homePath = await createTemporaryFolder();

        const initialRcFileContent = [
          `init-scope berry-test\n`,
          `npmScopes:\n`,
          `  testScope:\n`,
          `    npmRegistryServer: "${url}"\n`,
        ].join(``);

        await writeFile(`${homePath}/${RC_FILENAME}`, initialRcFileContent);

        let code;
        let stdout;
        let stderr;

        try {
          ({ code, stdout, stderr } = await run(`npm`, `login`, `--scope`, `testScope`, {
            env: {
              HOME: homePath,
              USERPROFILE: homePath,
              TEST_NPM_USER: `anotherTestUser`,
              TEST_NPM_PASSWORD: `password123`,
              YARN_RC_FILENAME: RC_FILENAME
            }
          }));
        } catch (error) {
          ({ code, stdout, stderr } = error);
        }

        const finalRcFileContent = await readFile(`${homePath}/${RC_FILENAME}`);
        const cleanFileContent = cleanupFileContent(finalRcFileContent.toString());

        expect(cleanFileContent).toMatchSnapshot();
        expect({code, stdout, stderr}).toMatchSnapshot();
      })
    );

    test(
      `should login a user with OTP to a specific scope`,
      makeTemporaryEnv({}, async ({ path, run, source }) => {
        const url = startPackageServer();
        const homePath = await createTemporaryFolder();

        const initialRcFileContent = [
          `init-scope berry-test\n`,
          `npmScopes:\n`,
          `  testScope:\n`,
          `    npmRegistryServer: "${url}"\n`,
        ].join(``);

        await writeFile(`${homePath}/${RC_FILENAME}`, initialRcFileContent);

        let code;
        let stdout;
        let stderr;

        try {
          ({ code, stdout, stderr } = await run(`npm`, `login`, `--scope`, `testScope`, {
            env: {
              HOME: homePath,
              USERPROFILE: homePath,
              TEST_NPM_USER: `testUser`,
              TEST_NPM_PASSWORD: `password`,
              TEST_NPM_2FA_TOKEN: `1234`,
              YARN_RC_FILENAME: RC_FILENAME
            }
          }));
        } catch (error) {
          ({ code, stdout, stderr } = error);
        }

        const finalRcFileContent = await readFile(`${homePath}/${RC_FILENAME}`);
        const cleanFileContent = cleanupFileContent(finalRcFileContent.toString());

        expect(cleanFileContent).toMatchSnapshot();
        expect({code, stdout, stderr}).toMatchSnapshot();
      })
    );
  });
});

function cleanupFileContent(fileContent) {
  return fileContent.replace(/http:\/\/localhost:\d+/g, FAKE_REGISTRY_URL);
}
