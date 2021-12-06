export {};

const {
  exec: {execFile},
} = require(`pkg-tests-core`);

describe(`npmPublishUtils.getGitHead`, () =>   {
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
        YARN_NPM_AUTH_TOKEN: `316158de-64b3-413e-a244-2de2b8d1c80f`,
      },
    });
  }));

  test(`it should not detect the gitHead for this repo`,
    makeTemporaryEnv({
      name: `githead-forbidden`,
      version: `1.0.0`,
    }, async ({path, run, source}) => {
      await run(`install`);

      await run(`npm`, `publish`, {
        env: {
          YARN_NPM_AUTH_TOKEN: `316158de-64b3-413e-a244-2de2b8d1c80f`,
        },
      });
    }));
});

describe(`--otp`, () =>   {
  test(`should fail when invalid otp is given`,
    makeTemporaryEnv({
      name: `otp-required`,
      version: `1.0.0`,
    }, async ({path, run, source}) => {
      await run(`install`);

      await expect(run(`npm`, `publish`, `--otp`, `invalid_otp`, {
        env: {
          YARN_NPM_AUTH_TOKEN: `686159dc-64b3-413e-a244-2de2b8d1c36f`,
        },
      })).rejects.toThrow();
    }));

  test(`should accept an otp and skip prompting for it`,
    makeTemporaryEnv({
      name: `otp-required`,
      version: `1.0.0`,
    }, async ({path, run, source}) => {
      await run(`install`);

      await expect(run(`npm`, `publish`, `--otp`, `1234`, {
        env: {
          YARN_NPM_AUTH_TOKEN: `686159dc-64b3-413e-a244-2de2b8d1c36f`,
        },
      })).resolves.toBeTruthy();
    }));
});
