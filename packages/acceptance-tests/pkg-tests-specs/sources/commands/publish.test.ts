import {npath, xfs} from '@yarnpkg/fslib';

const {
  tests: {testIf},
  misc,
} = require(`pkg-tests-core`);

const {
  exec: {execFile},
  tests: {validLogins},
} = require(`pkg-tests-core`);

describe(`publish`, () =>   {
  test(`it should detect the gitHead for this repo`, makeTemporaryEnv({
    name: `githead-required`,
    version: `1.0.0`,
  }, async ({path, run, source}) => {
    await execFile(`git`, [`init`], {cwd: path});

    // Otherwise we can't always commit
    await execFile(`git`, [`config`, `user.name`, `John Doe`], {cwd: path});
    await execFile(`git`, [`config`, `user.email`, `john.doe@example.org`], {cwd: path});
    await execFile(`git`, [`config`, `commit.gpgSign`, `false`], {cwd: path});

    await execFile(`git`, [`add`, `.`], {cwd: path});
    await execFile(`git`, [`commit`, `-m`, `wip`], {cwd: path});

    await run(`install`);

    await run(`npm`, `publish`, {
      env: {
        YARN_NPM_AUTH_TOKEN: validLogins.fooUser.npmAuthToken,
      },
    });
  }));

  test(`it should not detect the gitHead for this repo`, makeTemporaryEnv({
    name: `githead-forbidden`,
    version: `1.0.0`,
  }, async ({path, run, source}) => {
    await run(`install`);

    await run(`npm`, `publish`, {
      env: {
        YARN_NPM_AUTH_TOKEN: validLogins.fooUser.npmAuthToken,
      },
    });
  }));

  test(`should fail when invalid otp is given`,
    makeTemporaryEnv({
      name: `otp-required`,
      version: `1.0.0`,
    }, async ({path, run, source}) => {
      await run(`install`);

      await expect(run(`npm`, `publish`, `--otp`, `invalid_otp`, {
        env: {
          YARN_NPM_AUTH_TOKEN: validLogins.otpUser.npmAuthToken,
        },
      })).rejects.toThrowError(/Invalid OTP token/);
    }));

  test(`should accept an otp and skip prompting for it`, makeTemporaryEnv({
    name: `otp-required`,
    version: `1.0.0`,
  }, async ({path, run, source}) => {
    await run(`install`);

    await expect(run(`npm`, `publish`, `--otp`, validLogins.otpUser.npmOtpToken, {
      env: {
        YARN_NPM_AUTH_TOKEN: validLogins.otpUser.npmAuthToken,
      },
    })).resolves.toBeTruthy();
  }));

  test(`should publish a package with the readme content`, makeTemporaryEnv({
    name: `readme-required`,
    version: `1.0.0`,
  }, async ({path, run, source}) => {
    await run(`install`);

    const readmePath = npath.toPortablePath(`${path}/README.md`);
    await xfs.writeFilePromise(readmePath, `# title\n`);

    await run(`npm`, `publish`, {
      env: {
        YARN_NPM_AUTH_TOKEN: validLogins.fooUser.npmAuthToken,
      },
    });
  }));

  test(`should support --dry-run flag`, makeTemporaryEnv({
    name: `dry-run-test`,
    version: `1.0.0`,
  }, async ({path, run, source}) => {
    await run(`install`);

    const {stdout} = await run(`npm`, `publish`, `--dry-run`, `--tolerate-republish`);
    expect(stdout).toContain(`[DRY RUN]`);
  }));

  test(`should support --json flag`, makeTemporaryEnv({
    name: `json-test`,
    version: `1.0.0`,
  }, async ({path, run, source}) => {
    await run(`install`);

    const {stdout} = await run(`npm`, `publish`, `--json`, `--dry-run`, `--tolerate-republish`);
    const jsonObjects = misc.parseJsonStream(stdout);
    const result = jsonObjects.find((obj: any) => obj.name && obj.version);

    expect(result).toBeDefined();
    expect(result).toHaveProperty(`name`, `json-test`);
    expect(result).toHaveProperty(`version`, `1.0.0`);
    expect(result).toHaveProperty(`dryRun`, true);
    expect(result).toHaveProperty(`registry`);
    expect(result).toHaveProperty(`published`, false);
    expect(result).toHaveProperty(`message`);

    expect(result).toHaveProperty(`tag`);
    expect(result).toHaveProperty(`provenance`);

    expect(result).toHaveProperty(`files`);
    expect(Array.isArray(result.files)).toBe(true);
  }));

  test(`should correctly log name of scoped workspace`, makeTemporaryEnv({
    name: `@scope/json-test`,
    version: `1.0.0`,
  }, async ({path, run, source}) => {
    await run(`install`);

    const {stdout} = await run(`npm`, `publish`, `--json`, `--dry-run`, `--tolerate-republish`);
    const jsonObjects = misc.parseJsonStream(stdout);
    const result = jsonObjects.find((obj: any) => obj.name && obj.version);

    expect(result).toBeDefined();
    expect(result).toHaveProperty(`name`, `@scope/json-test`);
    expect(result).toHaveProperty(`version`, `1.0.0`);
    expect(result).toHaveProperty(`dryRun`, true);
    expect(result).toHaveProperty(`registry`);
    expect(result).toHaveProperty(`published`, false);
    expect(result).toHaveProperty(`message`);

    expect(result).toHaveProperty(`tag`);
    expect(result).toHaveProperty(`provenance`);

    expect(result).toHaveProperty(`files`);
    expect(Array.isArray(result.files)).toBe(true);
  }));

  testIf(
    () => !!process.env.ACTIONS_ID_TOKEN_REQUEST_URL,
    `should publish a package with a valid provenance statement`,
    makeTemporaryEnv({
      name: `provenance-required`,
      version: `1.0.0`,
    }, async ({run}) => {
      await run(`install`);

      const githubEnv = Object.fromEntries(
        Object.entries(process.env).filter(([key]) => (
          key.startsWith(`ACTIONS_`) || key.startsWith(`GITHUB_`) || key.startsWith(`RUNNER_`)),
        ),
      );

      await run(`npm`, `publish`, {
        env: {
          ...githubEnv,
          YARN_NPM_AUTH_TOKEN: validLogins.fooUser.npmAuthToken,
          YARN_NPM_PUBLISH_PROVENANCE: `true`,
        },
      });
    }),
  );
});
