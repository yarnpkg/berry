import {Filename, PortablePath, ppath, xfs} from '@yarnpkg/fslib';

const {
  tests: {startPackageServer, validLogins},
} = require(`pkg-tests-core`);

const SPEC_RC_FILENAME = `.spec-yarnrc` as Filename;

describe(`Commands`, () => {
  describe(`npm login`, () => {
    test(
      `it should login a user with no OTP setup`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const rcPath = ppath.join(path, PortablePath.parent, SPEC_RC_FILENAME);
        await xfs.writeFilePromise(rcPath, ``);

        const {code, stdout, stderr} = await run(`npm`, `login`, {
          env: {
            YARN_INJECT_NPM_USER: validLogins.fooUser.username,
            YARN_INJECT_NPM_PASSWORD: validLogins.fooUser.password,
            YARN_RC_FILENAME: SPEC_RC_FILENAME,
          },
        });

        expect(code).toEqual(0);
        expect(stdout).toContain(`Successfully logged in`);
        expect(stderr).toEqual(``);

        const url = await startPackageServer();

        const {stdout: token} = await run(`config`, `get`, `npmRegistries["${url}"].npmAuthToken`, `--no-redacted`, {
          env: {
            YARN_RC_FILENAME: SPEC_RC_FILENAME,
          },
        });

        expect(token).toEqual(`${validLogins.fooUser.npmAuthToken}\n`);
      }),
    );

    test(
      `it should login a user with OTP setup`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const rcPath = ppath.join(path, PortablePath.parent, SPEC_RC_FILENAME);
        await xfs.writeFilePromise(rcPath, ``);

        const {code, stdout, stderr} = await run(`npm`, `login`, {
          env: {
            YARN_INJECT_NPM_USER: validLogins.otpUser.username,
            YARN_INJECT_NPM_PASSWORD: validLogins.otpUser.password,
            YARN_INJECT_NPM_2FA_TOKEN: validLogins.otpUser.npmOtpToken,
            YARN_RC_FILENAME: SPEC_RC_FILENAME,
          },
        });

        expect(code).toEqual(0);
        expect(stdout).toContain(`Successfully logged in`);
        expect(stderr).toEqual(``);

        const url = await startPackageServer();

        const {stdout: token} = await run(`config`, `get`, `npmRegistries["${url}"].npmAuthToken`, `--no-redacted`, {
          env: {
            YARN_RC_FILENAME: SPEC_RC_FILENAME,
          },
        });

        expect(token).toEqual(`${validLogins.otpUser.npmAuthToken}\n`);
      }),
    );

    test(
      `it should print the npm-notice when an OTP is requested`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const rcPath = ppath.join(path, PortablePath.parent, SPEC_RC_FILENAME);
        await xfs.writeFilePromise(rcPath, ``);

        const {code, stdout, stderr} = await run(`npm`, `login`, {
          env: {
            YARN_INJECT_NPM_USER: validLogins.otpUserWithNotice.username,
            YARN_INJECT_NPM_PASSWORD: validLogins.otpUserWithNotice.password,
            YARN_INJECT_NPM_2FA_TOKEN: validLogins.otpUserWithNotice.npmOtpToken,
            YARN_RC_FILENAME: SPEC_RC_FILENAME,
          },
        });

        expect(code).toEqual(0);
        expect(stdout).toContain(`You're looking handsome today`);
        expect(stdout).toContain(`Successfully logged in`);
        expect(stderr).toEqual(``);

        const url = await startPackageServer();

        const {stdout: token} = await run(`config`, `get`, `npmRegistries["${url}"].npmAuthToken`, `--no-redacted`, {
          env: {
            YARN_RC_FILENAME: SPEC_RC_FILENAME,
          },
        });

        expect(token).toEqual(`${validLogins.otpUserWithNotice.npmAuthToken}\n`);
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

        const {code, stdout, stderr} = await run(`npm`, `login`, `--scope`, `testScope`, {
          env: {
            YARN_INJECT_NPM_USER: validLogins.fooUser.username,
            YARN_INJECT_NPM_PASSWORD: validLogins.fooUser.password,
            YARN_RC_FILENAME: SPEC_RC_FILENAME,
          },
        });

        expect(code).toEqual(0);
        expect(stdout).toContain(`Successfully logged in`);
        expect(stderr).toEqual(``);

        const {stdout: token} = await run(`config`, `get`, `npmScopes["testScope"].npmAuthToken`, `--no-redacted`, {
          env: {
            YARN_RC_FILENAME: SPEC_RC_FILENAME,
          },
        });

        expect(token).toEqual(`${validLogins.fooUser.npmAuthToken}\n`);
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

        const {code, stdout, stderr} = await run(`npm`, `login`, `--scope`, `testScope`, {
          env: {
            YARN_INJECT_NPM_USER: validLogins.otpUser.username,
            YARN_INJECT_NPM_PASSWORD: validLogins.otpUser.password,
            YARN_INJECT_NPM_2FA_TOKEN: validLogins.otpUser.npmOtpToken,
            YARN_RC_FILENAME: SPEC_RC_FILENAME,
          },
        });

        expect(code).toEqual(0);
        expect(stdout).toContain(`Successfully logged in`);
        expect(stderr).toEqual(``);

        const {stdout: token} = await run(`config`, `get`, `npmScopes["testScope"].npmAuthToken`, `--no-redacted`, {
          env: {
            YARN_RC_FILENAME: SPEC_RC_FILENAME,
          },
        });

        expect(token).toEqual(`${validLogins.otpUser.npmAuthToken}\n`);
      }),
    );

    test(
      `it should store npmAlwaysAuth when passed as option`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const rcPath = ppath.join(path, PortablePath.parent, SPEC_RC_FILENAME);
        await xfs.writeFilePromise(rcPath, ``);

        const {code, stdout, stderr} = await run(`npm`, `login`, `--always-auth`, {
          env: {
            YARN_INJECT_NPM_USER: validLogins.fooUser.username,
            YARN_INJECT_NPM_PASSWORD: validLogins.fooUser.password,
            YARN_RC_FILENAME: SPEC_RC_FILENAME,
          },
        });

        expect(code).toEqual(0);
        expect(stdout).toContain(`Successfully logged in`);
        expect(stderr).toEqual(``);

        const {stdout: npmRegistriesConfig} = await run(`config`, `get`, `npmRegistries`, `--json`, `--no-redacted`, {
          env: {
            YARN_RC_FILENAME: SPEC_RC_FILENAME,
          },
        });

        expect(JSON.parse(npmRegistriesConfig)).toMatchObject({
          [`http://registry.example.org`]: {
            npmAlwaysAuth: true,
            npmAuthToken: validLogins.fooUser.npmAuthToken,
          },
        });
      }),
    );
  });
});
