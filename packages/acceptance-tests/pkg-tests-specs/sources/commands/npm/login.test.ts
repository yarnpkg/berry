import {Filename, PortablePath, ppath, xfs} from '@yarnpkg/fslib';
import {parseSyml}                          from '@yarnpkg/parsers';

const {
  tests: {startPackageServer, setWebLoginMock, validLogins},
} = require(`pkg-tests-core`);

const SPEC_RC_FILENAME = `.spec-yarnrc` as Filename;

// The interactive prompt that precedes the report lines is rendered differently
// on each platform, so the web login tests only snapshot the report lines.
const getReportLines = (stdout: string) => stdout.split(/\r?\n/).filter(line => line.startsWith(`➤ YN0000:`));
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
      `it should print the npm-notice during web login`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const rcPath = ppath.join(path, PortablePath.parent, SPEC_RC_FILENAME);
        await xfs.writeFilePromise(rcPath, ``);

        const notice = `Verification code: 123456. Enter this code in the browser to complete the login.`;

        let code;
        let stdout;
        let stderr;

        try {
          await setWebLoginMock({notice}, async () => {
            ({code, stdout, stderr} = await run(`npm`, `login`, `--web-login`, {
              stdin: `n\n`,
              env: {
                YARN_RC_FILENAME: SPEC_RC_FILENAME,
              },
            }));
          });
        } catch (error) {
          ({code, stdout, stderr} = error);
        }

        expect(stdout).toContain(notice);
        expect(stdout.indexOf(notice)).toBeLessThan(stdout.indexOf(`Starting the web login process`));

        const finalRcFileContent = await xfs.readFilePromise(rcPath, `utf8`);
        const cleanFileContent = cleanupFileContent(finalRcFileContent);

        expect(cleanFileContent).toMatchSnapshot();
        expect({code, stderr, report: getReportLines(stdout)}).toMatchSnapshot();
      }),
    );

    test(
      `it should print each npm-notice during web login`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const rcPath = ppath.join(path, PortablePath.parent, SPEC_RC_FILENAME);
        await xfs.writeFilePromise(rcPath, ``);

        let code;
        let stdout;
        let stderr;

        try {
          await setWebLoginMock({notice: [`First notice`, `Second notice`]}, async () => {
            ({code, stdout, stderr} = await run(`npm`, `login`, `--web-login`, {
              stdin: `n\n`,
              env: {
                YARN_RC_FILENAME: SPEC_RC_FILENAME,
              },
            }));
          });
        } catch (error) {
          ({code, stdout, stderr} = error);
        }

        expect(stdout.indexOf(`First notice`)).toBeLessThan(stdout.indexOf(`Second notice`));
        expect(stdout.indexOf(`Second notice`)).toBeLessThan(stdout.indexOf(`Starting the web login process`));

        const finalRcFileContent = await xfs.readFilePromise(rcPath, `utf8`);
        const cleanFileContent = cleanupFileContent(finalRcFileContent);

        expect(cleanFileContent).toMatchSnapshot();
        expect({code, stderr, report: getReportLines(stdout)}).toMatchSnapshot();
      }),
    );

    test(
      `it should not print anything extra when the web login response has no npm-notice`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const rcPath = ppath.join(path, PortablePath.parent, SPEC_RC_FILENAME);
        await xfs.writeFilePromise(rcPath, ``);

        let code;
        let stdout;
        let stderr;

        try {
          await setWebLoginMock({}, async () => {
            ({code, stdout, stderr} = await run(`npm`, `login`, `--web-login`, {
              stdin: `n\n`,
              env: {
                YARN_RC_FILENAME: SPEC_RC_FILENAME,
              },
            }));
          });
        } catch (error) {
          ({code, stdout, stderr} = error);
        }

        const finalRcFileContent = await xfs.readFilePromise(rcPath, `utf8`);
        const cleanFileContent = cleanupFileContent(finalRcFileContent);

        expect(cleanFileContent).toMatchSnapshot();
        expect({code, stderr, report: getReportLines(stdout)}).toMatchSnapshot();
      }),
    );

    test(
      `it should strip ANSI sequences and control characters from the npm-notice during web login`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const rcPath = ppath.join(path, PortablePath.parent, SPEC_RC_FILENAME);
        await xfs.writeFilePromise(rcPath, ``);

        const notice = `Verification\u009b31m code:\u0085 123\u009b0m456\u009f\u0009`;

        let code;
        let stdout;
        let stderr;

        try {
          await setWebLoginMock({notice}, async () => {
            ({code, stdout, stderr} = await run(`npm`, `login`, `--web-login`, {
              stdin: `n\n`,
              env: {
                YARN_RC_FILENAME: SPEC_RC_FILENAME,
              },
            }));
          });
        } catch (error) {
          ({code, stdout, stderr} = error);
        }

        expect(stdout).toContain(`Verification code: 123456`);
        expect(stdout).not.toContain(`\u0085`);
        expect(stdout).not.toContain(`\u009b`);
        expect(stdout).not.toContain(`\u009f`);
        expect(stdout).not.toContain(`\u0009`);

        const finalRcFileContent = await xfs.readFilePromise(rcPath, `utf8`);
        const cleanFileContent = cleanupFileContent(finalRcFileContent);

        expect(cleanFileContent).toMatchSnapshot();
        expect({code, stderr, report: getReportLines(stdout)}).toMatchSnapshot();
      }),
    );

    test(
      `it should fall back to password login when web login init fails`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const rcPath = ppath.join(path, PortablePath.parent, SPEC_RC_FILENAME);
        await xfs.writeFilePromise(rcPath, ``);

        let code;
        let stdout;
        let stderr;

        try {
          await setWebLoginMock({initFails: true}, async () => {
            ({code, stdout, stderr} = await run(`npm`, `login`, `--web-login`, {
              env: {
                YARN_INJECT_NPM_USER: validLogins.fooUser.username,
                YARN_INJECT_NPM_PASSWORD: validLogins.fooUser.password,
                YARN_RC_FILENAME: SPEC_RC_FILENAME,
              },
            }));
          });
        } catch (error) {
          ({code, stdout, stderr} = error);
        }

        expect(stdout).toContain(`Logging in to`);
        expect(stdout).toContain(`Successfully logged in`);

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
