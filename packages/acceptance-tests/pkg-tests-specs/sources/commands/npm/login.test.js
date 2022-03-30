const {
  fs: {createTemporaryFolder, readFile, writeFile},
  tests: {startPackageServer, validLogins},
} = require(`pkg-tests-core`);

const SPEC_RC_FILENAME = `.spec-yarnrc`;
const FAKE_REGISTRY_URL = `http://yarn.test.registry`;

function cleanupFileContent(fileContent) {
  return fileContent.replace(/http:\/\/localhost:\d+/g, FAKE_REGISTRY_URL);
}

describe(`Commands`, () => {
  describe(`npm login`, () => {
    test(
      `it should login a user with no OTP setup`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const homePath = await createTemporaryFolder();
        await writeFile(`${homePath}/${SPEC_RC_FILENAME}`, ``);

        let code;
        let stdout;
        let stderr;

        try {
          ({code, stdout, stderr} = await run(`npm`, `login`, {
            env: {
              HOME: homePath,
              USERPROFILE: homePath,
              TEST_NPM_USER: validLogins.fooUser.username,
              TEST_NPM_PASSWORD: validLogins.fooUser.password,
              YARN_RC_FILENAME: SPEC_RC_FILENAME,
            },
          }));
        } catch (error) {
          ({code, stdout, stderr} = error);
        }

        const finalRcFileContent = await readFile(`${homePath}/${SPEC_RC_FILENAME}`, `utf8`);
        const cleanFileContent = cleanupFileContent(finalRcFileContent);

        expect(cleanFileContent).toMatchSnapshot();
        expect({code, stdout, stderr}).toMatchSnapshot();
      }),
    );

    test(
      `it should login a user with OTP setup`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const homePath = await createTemporaryFolder();

        await writeFile(`${homePath}/${SPEC_RC_FILENAME}`, ``);

        let code;
        let stdout;
        let stderr;

        try {
          ({code, stdout, stderr} = await run(`npm`, `login`, {
            env: {
              HOME: homePath,
              USERPROFILE: homePath,
              TEST_NPM_USER: validLogins.otpUser.username,
              TEST_NPM_PASSWORD: validLogins.otpUser.password,
              TEST_NPM_2FA_TOKEN: validLogins.otpUser.npmOtpToken,
              YARN_RC_FILENAME: SPEC_RC_FILENAME,
            },
          }));
        } catch (error) {
          ({code, stdout, stderr} = error);
        }

        const finalRcFileContent = await readFile(`${homePath}/${SPEC_RC_FILENAME}`, `utf8`);
        const cleanFileContent = cleanupFileContent(finalRcFileContent);

        expect(cleanFileContent).toMatchSnapshot();
        expect({code, stdout, stderr}).toMatchSnapshot();
      }),
    );

    test(
      `it should throw an error when credentials are incorrect`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await expect(
          run(`npm`, `login`, {
            env: {
              TEST_NPM_USER: validLogins.fooUser.username,
              TEST_NPM_PASSWORD: `incorrect password`,
            },
          }),
        ).rejects.toThrowError(/Invalid authentication \(attempted as foo-user\)/);
      }),
    );

    test(
      `it should throw an error with incorrect OTP`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await expect(
          run(`npm`, `login`, {
            env: {
              TEST_NPM_USER: validLogins.otpUser.username,
              TEST_NPM_PASSWORD: validLogins.otpUser.password,
              TEST_NPM_2FA_TOKEN: `incorrect OTP`,
            },
          }),
        ).rejects.toThrowError(/Invalid OTP token/);
      }),
    );

    test(
      `it should login a user with no OTP setup to a specific scope`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const url = await startPackageServer();
        const homePath = await createTemporaryFolder();

        await writeFile(`${homePath}/${SPEC_RC_FILENAME}`, [
          `npmScopes:\n`,
          `  testScope:\n`,
          `    npmRegistryServer: "${url}"\n`,
        ].join(``));

        let code;
        let stdout;
        let stderr;

        try {
          ({code, stdout, stderr} = await run(`npm`, `login`, `--scope`, `testScope`, {
            env: {
              HOME: homePath,
              USERPROFILE: homePath,
              TEST_NPM_USER: validLogins.fooUser.username,
              TEST_NPM_PASSWORD: validLogins.fooUser.password,
              YARN_RC_FILENAME: SPEC_RC_FILENAME,
            },
          }));
        } catch (error) {
          ({code, stdout, stderr} = error);
        }

        const finalRcFileContent = await readFile(`${homePath}/${SPEC_RC_FILENAME}`, `utf8`);
        const cleanFileContent = cleanupFileContent(finalRcFileContent);

        expect(cleanFileContent).toMatchSnapshot();
        expect({code, stdout, stderr}).toMatchSnapshot();
      }),
    );

    test(
      `it should login a user with OTP to a specific scope`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const url = await startPackageServer();
        const homePath = await createTemporaryFolder();

        const initialRcFileContent = [
          `npmScopes:\n`,
          `  testScope:\n`,
          `    npmRegistryServer: "${url}"\n`,
        ].join(``);

        await writeFile(`${homePath}/${SPEC_RC_FILENAME}`, initialRcFileContent);

        let code;
        let stdout;
        let stderr;

        try {
          ({code, stdout, stderr} = await run(`npm`, `login`, `--scope`, `testScope`, {
            env: {
              HOME: homePath,
              USERPROFILE: homePath,
              TEST_NPM_USER: validLogins.otpUser.username,
              TEST_NPM_PASSWORD: validLogins.otpUser.password,
              TEST_NPM_2FA_TOKEN: validLogins.otpUser.npmOtpToken,
              YARN_RC_FILENAME: SPEC_RC_FILENAME,
            },
          }));
        } catch (error) {
          ({code, stdout, stderr} = error);
        }

        const finalRcFileContent = await readFile(`${homePath}/${SPEC_RC_FILENAME}`, `utf8`);
        const cleanFileContent = cleanupFileContent(finalRcFileContent);

        expect(cleanFileContent).toMatchSnapshot();
        expect({code, stdout, stderr}).toMatchSnapshot();
      }),
    );
  });
});
