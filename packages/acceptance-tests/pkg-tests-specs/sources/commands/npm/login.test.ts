import {Filename, PortablePath, ppath, xfs} from '@yarnpkg/fslib';
import {parseSyml}                          from '@yarnpkg/parsers';

const {
  tests: {startPackageServer, validLogins},
} = require(`pkg-tests-core`);

const SPEC_RC_FILENAME = `.spec-yarnrc` as Filename;
const FAKE_REGISTRY_URL = `http://yarn.test.registry`;

function cleanupFileContent(fileContent: string) {
  return JSON.stringify(parseSyml(fileContent.replace(/http:\/\/localhost:\d+/g, FAKE_REGISTRY_URL)), null, 2);
}

describe(`Commands`, () => {
  describe(`npm login`, () => {
    test(
      `it should login a user with no OTP setup`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const rcPath = ppath.join(path, PortablePath.parent, SPEC_RC_FILENAME);
        await xfs.writeFilePromise(rcPath, ``);

        let code;
        let stdout;
        let stderr;

        try {
          ({code, stdout, stderr} = await run(`npm`, `login`, {
            env: {
              YARN_INJECT_NPM_USER: validLogins.fooUser.username,
              YARN_INJECT_NPM_PASSWORD: validLogins.fooUser.password,
              YARN_RC_FILENAME: SPEC_RC_FILENAME,
            },
          }));
        } catch (error) {
          ({code, stdout, stderr} = error);
        }

        const finalRcFileContent = await xfs.readFilePromise(ppath.join(path, PortablePath.parent, SPEC_RC_FILENAME), `utf8`);
        const cleanFileContent = cleanupFileContent(finalRcFileContent);

        expect(cleanFileContent).toMatchSnapshot();
        expect({code, stdout, stderr}).toMatchSnapshot();
      }),
    );

    test(
      `it should login a user with OTP setup`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const rcPath = ppath.join(path, PortablePath.parent, SPEC_RC_FILENAME);
        await xfs.writeFilePromise(rcPath, ``);

        let code;
        let stdout;
        let stderr;

        try {
          ({code, stdout, stderr} = await run(`npm`, `login`, {
            env: {
              YARN_INJECT_NPM_USER: validLogins.otpUser.username,
              YARN_INJECT_NPM_PASSWORD: validLogins.otpUser.password,
              YARN_INJECT_NPM_2FA_TOKEN: validLogins.otpUser.npmOtpToken,
              YARN_RC_FILENAME: SPEC_RC_FILENAME,
            },
          }));
        } catch (error) {
          ({code, stdout, stderr} = error);
        }

        const finalRcFileContent = await xfs.readFilePromise(rcPath, `utf8`);
        const cleanFileContent = cleanupFileContent(finalRcFileContent);

        expect(cleanFileContent).toMatchSnapshot();
        expect({code, stdout, stderr}).toMatchSnapshot();
      }),
    );

    test(
      `it should print the npm-notice when an OTP is requested`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const rcPath = ppath.join(path, PortablePath.parent, SPEC_RC_FILENAME);
        await xfs.writeFilePromise(rcPath, ``);

        let code;
        let stdout;
        let stderr;

        try {
          ({code, stdout, stderr} = await run(`npm`, `login`, {
            env: {
              YARN_INJECT_NPM_USER: validLogins.otpUserWithNotice.username,
              YARN_INJECT_NPM_PASSWORD: validLogins.otpUserWithNotice.password,
              YARN_INJECT_NPM_2FA_TOKEN: validLogins.otpUserWithNotice.npmOtpToken,
              YARN_RC_FILENAME: SPEC_RC_FILENAME,
            },
          }));
        } catch (error) {
          ({code, stdout, stderr} = error);
        }

        const finalRcFileContent = await xfs.readFilePromise(rcPath, `utf8`);
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
              YARN_INJECT_NPM_USER: validLogins.fooUser.username,
              YARN_INJECT_NPM_PASSWORD: `incorrect password`,
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
              YARN_INJECT_NPM_USER: validLogins.otpUser.username,
              YARN_INJECT_NPM_PASSWORD: validLogins.otpUser.password,
              YARN_INJECT_NPM_2FA_TOKEN: `incorrect OTP`,
            },
          }),
        ).rejects.toThrowError(/Invalid OTP token/);
      }),
    );

    test(
      `it should login a user with no OTP setup to a specific scope`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const url = await startPackageServer();

        const rcPath = ppath.join(path, PortablePath.parent, SPEC_RC_FILENAME);
        await xfs.writeJsonPromise(rcPath, {
          npmScopes: {
            testScope: {
              npmRegistryServer: url,
            },
          },
        });

        let code;
        let stdout;
        let stderr;

        try {
          ({code, stdout, stderr} = await run(`npm`, `login`, `--scope`, `testScope`, {
            env: {
              YARN_INJECT_NPM_USER: validLogins.fooUser.username,
              YARN_INJECT_NPM_PASSWORD: validLogins.fooUser.password,
              YARN_RC_FILENAME: SPEC_RC_FILENAME,
            },
          }));
        } catch (error) {
          ({code, stdout, stderr} = error);
        }

        const finalRcFileContent = await xfs.readFilePromise(rcPath, `utf8`);
        const cleanFileContent = cleanupFileContent(finalRcFileContent);

        expect(cleanFileContent).toMatchSnapshot();
        expect({code, stdout, stderr}).toMatchSnapshot();
      }),
    );

    test(
      `it should login a user with OTP to a specific scope`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const url = await startPackageServer();

        const rcPath = ppath.join(path, PortablePath.parent, SPEC_RC_FILENAME);
        await xfs.writeJsonPromise(rcPath, {
          npmScopes: {
            testScope: {
              npmRegistryServer: url,
            },
          },
        });

        let code;
        let stdout;
        let stderr;

        try {
          ({code, stdout, stderr} = await run(`npm`, `login`, `--scope`, `testScope`, {
            env: {
              YARN_INJECT_NPM_USER: validLogins.otpUser.username,
              YARN_INJECT_NPM_PASSWORD: validLogins.otpUser.password,
              YARN_INJECT_NPM_2FA_TOKEN: validLogins.otpUser.npmOtpToken,
              YARN_RC_FILENAME: SPEC_RC_FILENAME,
            },
          }));
        } catch (error) {
          ({code, stdout, stderr} = error);
        }

        const finalRcFileContent = await xfs.readFilePromise(rcPath, `utf8`);
        const cleanFileContent = cleanupFileContent(finalRcFileContent);

        expect(cleanFileContent).toMatchSnapshot();
        expect({code, stdout, stderr}).toMatchSnapshot();
      }),
    );

    test(
      `it should store npmAlwaysAuth when passed as option`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const rcPath = ppath.join(path, PortablePath.parent, SPEC_RC_FILENAME);
        await xfs.writeFilePromise(rcPath, ``);

        let code;
        let stdout;
        let stderr;

        try {
          ({code, stdout, stderr} = await run(`npm`, `login`, `--always-auth`, {
            env: {
              YARN_INJECT_NPM_USER: validLogins.fooUser.username,
              YARN_INJECT_NPM_PASSWORD: validLogins.fooUser.password,
              YARN_RC_FILENAME: SPEC_RC_FILENAME,
            },
          }));
        } catch (error) {
          ({code, stdout, stderr} = error);
        }

        expect({code, stdout, stderr}).toMatchSnapshot();

        const {stdout: npmRegistriesConfig} = await run(`config`, `get`, `--json`, `npmRegistries`, {
          env: {
            YARN_RC_FILENAME: SPEC_RC_FILENAME,
          },
        });

        expect(JSON.parse(npmRegistriesConfig)[`http://registry.example.org`]?.npmAlwaysAuth).toBe(true);
      }),
    );
  });
});
