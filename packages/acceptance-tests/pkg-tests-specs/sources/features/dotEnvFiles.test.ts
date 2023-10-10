import {Filename, ppath, xfs} from '@yarnpkg/fslib';

describe(`DotEnv files`, () => {
  it(`should automatically inject a .env.yarn file in the environment`, makeTemporaryEnv({}, async ({path, run, source}) => {
    await run(`install`);

    await xfs.writeFilePromise(ppath.join(path, `.env.yarn`), [
      `INJECTED_FROM_ENV_FILE=hello\n`,
    ].join(``));

    await expect(run(`exec`, `env`)).resolves.toMatchObject({
      stdout: expect.stringMatching(/^INJECTED_FROM_ENV_FILE=hello$/m),
    });
  }));

  it(`should allow .env variables to be interpolated`, makeTemporaryEnv({}, async ({path, run, source}) => {
    await run(`install`);

    await xfs.writeFilePromise(ppath.join(path, `.env.yarn`), [
      `INJECTED_FROM_ENV_FILE=\${FOO}\n`,
    ].join(``));

    await expect(run(`exec`, `env`, {env: {FOO: `foo`}})).resolves.toMatchObject({
      stdout: expect.stringMatching(/^INJECTED_FROM_ENV_FILE=foo$/m),
    });
  }));

  it(`should allow .env variables to be used in the next ones`, makeTemporaryEnv({}, async ({path, run, source}) => {
    await run(`install`);

    await xfs.writeFilePromise(ppath.join(path, `.env.yarn`), [
      `INJECTED_FROM_ENV_FILE_1=hello\n`,
      `INJECTED_FROM_ENV_FILE_2=\${INJECTED_FROM_ENV_FILE_1} world\n`,
    ].join(``));

    await expect(run(`exec`, `env`, {env: {FOO: `foo`}})).resolves.toMatchObject({
      stdout: expect.stringMatching(/^INJECTED_FROM_ENV_FILE_2=hello world$/m),
    });
  }));

  it(`shouldn't read the .env.yarn file if the injectEnvironmentFiles setting is defined`, makeTemporaryEnv({}, async ({path, run, source}) => {
    await xfs.writeJsonPromise(ppath.join(path, Filename.rc), {
      injectEnvironmentFiles: [],
    });

    await xfs.writeFilePromise(ppath.join(path, `.my-env`), [
      `INJECTED_FROM_ENV_FILE=hello\n`,
    ].join(``));

    await run(`install`);

    await expect(run(`exec`, `env`)).resolves.toMatchObject({
      stdout: expect.not.stringMatching(/^INJECTED_FROM_ENV_FILE=/m),
    });
  }));

  it(`should allow multiple environment files to be defined`, makeTemporaryEnv({}, async ({path, run, source}) => {
    await xfs.writeJsonPromise(ppath.join(path, Filename.rc), {
      injectEnvironmentFiles: [`.my-env`, `.my-other-env`],
    });

    await xfs.writeFilePromise(ppath.join(path, `.my-env`), [
      `INJECTED_FROM_ENV_FILE_1=hello\n`,
    ].join(``));

    await xfs.writeFilePromise(ppath.join(path, `.my-other-env`), [
      `INJECTED_FROM_ENV_FILE_2=world\n`,
    ].join(``));

    await run(`install`);

    const {stdout} = await run(`exec`, `env`);

    expect(stdout).toMatch(/^INJECTED_FROM_ENV_FILE_1=hello$/m);
    expect(stdout).toMatch(/^INJECTED_FROM_ENV_FILE_2=world$/m);
  }));

  it(`should let the last environment file override the first`, makeTemporaryEnv({}, async ({path, run, source}) => {
    await xfs.writeJsonPromise(ppath.join(path, Filename.rc), {
      injectEnvironmentFiles: [`.my-env`, `.my-other-env`],
    });

    await xfs.writeFilePromise(ppath.join(path, `.my-env`), [
      `INJECTED_FROM_ENV_FILE=hello\n`,
    ].join(``));

    await xfs.writeFilePromise(ppath.join(path, `.my-other-env`), [
      `INJECTED_FROM_ENV_FILE=world\n`,
    ].join(``));

    await run(`install`);

    await expect(run(`exec`, `env`)).resolves.toMatchObject({
      stdout: expect.stringMatching(/^INJECTED_FROM_ENV_FILE=world$/m),
    });
  }));

  it(`should throw an error if the settings reference a non-existing file`, makeTemporaryEnv({}, async ({path, run, source}) => {
    await xfs.writeJsonPromise(ppath.join(path, Filename.rc), {
      injectEnvironmentFiles: [`.my-env`],
    });

    await expect(run(`install`)).rejects.toThrow();
  }));

  it(`shouldn't throw an error if the settings reference a non-existing file with a ?-suffixed path`, makeTemporaryEnv({}, async ({path, run, source}) => {
    await xfs.writeJsonPromise(ppath.join(path, Filename.rc), {
      injectEnvironmentFiles: [`.my-env?`],
    });

    await run(`install`);
  }));

  it(`should allow values from environment files to be reused in other configuration settings`, makeTemporaryEnv({}, async ({path, run, source}) => {
    await run(`install`);

    await xfs.writeFilePromise(ppath.join(path, `.env.yarn`), [
      `INJECTED_FROM_ENV_FILE=hello\n`,
    ].join(``));

    await xfs.writeJsonPromise(ppath.join(path, Filename.rc), {
      initScope: `\${INJECTED_FROM_ENV_FILE}`,
    });

    await expect(run(`config`, `get`, `initScope`)).resolves.toMatchObject({
      stdout: `hello\n`,
    });
  }));
});
