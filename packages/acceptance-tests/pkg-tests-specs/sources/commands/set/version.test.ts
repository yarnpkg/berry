import {xfs, ppath, PortablePath, Filename} from '@yarnpkg/fslib';

const yarnrcRegexp = /^yarnPath:/;

describe(`Commands`, () => {
  describe(`set version`, () => {
    test(
      `it shouldn't set yarnPath if corepack is enabled and the version is semver`,
      makeTemporaryEnv({}, {
        env: {COREPACK_ROOT: `/path/to/corepack`},
      }, async ({path, run, source}) => {
        await run(`set`, `version`, `3.0.0`);
        await check(path, {corepackVersion: `3.0.0`, usePath: false});
      }),
    );

    test(
      `it should set yarnPath if corepack is disabled, even when the version is semver`,
      makeTemporaryEnv({}, {
        env: {COREPACK_ROOT: undefined},
      }, async ({path, run, source}) => {
        await run(`set`, `version`, `3.0.0`);
        await check(path, {corepackVersion: `3.0.0`, usePath: true});
      }),
    );

    test(
      `it should always set yarnPath if one already exists`,
      makeTemporaryEnv({}, {
        env: {
          COREPACK_ROOT: `/path/to/corepack`,
          YARN_IS_TEST_ENV: undefined,
          YARN_CACHE_VERSION_OVERRIDE: undefined,
        },
      }, async ({path, run, source}) => {
        // To force yarnPath to be set; followed by a sanity check
        await run(`set`, `version`, `3.0.0`, {env: {COREPACK_ROOT: undefined}});
        await check(path, {corepackVersion: `3.0.0`, usePath: true});

        await run(`set`, `version`, `3.0.0`);
        await check(path, {corepackVersion: `3.0.0`, usePath: true});
      }),
    );

    test(
      `it should always set yarnPath if --yarn-path is set`,
      makeTemporaryEnv({}, {
        env: {COREPACK_ROOT: `/path/to/corepack`},
      }, async ({path, run, source}) => {
        await run(`set`, `version`, `3.0.0`, `--yarn-path`);
        await check(path, {corepackVersion: `3.0.0`, usePath: true});
      }),
    );

    test(
      `it should never set yarnPath if --no-yarn-path is set`,
      makeTemporaryEnv({}, {
        env: {COREPACK_ROOT: undefined},
      }, async ({path, run, source}) => {
        await run(`set`, `version`, `3.0.0`, `--no-yarn-path`);
        await check(path, {corepackVersion: `3.0.0`, usePath: false});
      }),
    );

    test(
      `it should prevent using --no-yarn-path with arbitrary files`,
      makeTemporaryEnv({}, {
        env: {COREPACK_ROOT: undefined},
      }, async ({path, run, source}) => {
        const yarnIndirection = ppath.join(path, `custom-yarn.cjs`);
        await xfs.writeFilePromise(yarnIndirection, ``);

        await expect(run(`set`, `version`, yarnIndirection, `--no-yarn-path`)).rejects.toThrow();
      }),
    );

    test(
      `it should set yarnPath if the version is an arbitrary file`,
      makeTemporaryEnv({}, {
        env: {COREPACK_ROOT: undefined},
      }, async ({path, run, source}) => {
        const yarnIndirection = ppath.join(path, `custom-yarn.cjs`);
        await xfs.writeFilePromise(yarnIndirection, ``);

        await run(`set`, `version`, yarnIndirection);
        await check(path, {corepackVersion: /[0-9]+\./, usePath: true});
      }),
    );

    test(
      `it should set yarnPath even if yarnPath is set outside of the project`,
      makeTemporaryEnv({}, {
        env: {COREPACK_ROOT: undefined},
      }, async ({path, run, source}) => {
        await run(`set`, `version`, `self`);
        await check(path, {corepackVersion: /[0-9]+\./, usePath: true});

        const projectDir = ppath.join(path, `project`);
        await xfs.mkdirPromise(projectDir);
        await xfs.writeJsonPromise(ppath.join(projectDir, Filename.manifest), {});
        await xfs.writeFilePromise(ppath.join(projectDir, Filename.lockfile), ``);

        await run(`set`, `version`, `self`, {cwd: projectDir});
        await check(projectDir, {corepackVersion: /[0-9]+\./, usePath: true});
      }),
    );

    test(
      `it shouldn't set the version when using '--only-if-needed' and a yarnPath is already set`,
      makeTemporaryEnv({}, {
        env: {COREPACK_ROOT: undefined},
      }, async ({path, run, source}) => {
        await run(`set`, `version`, `self`);

        const before = await xfs.readFilePromise(ppath.join(path, Filename.rc), `utf8`);
        expect(before).not.toEqual(`.yarn/releases/yarn-3.0.0.cjs`);

        await run(`set`, `version`, `3.0.0`, `--only-if-needed`);

        const after = await xfs.readFilePromise(ppath.join(path, Filename.rc), `utf8`);
        expect(after).toEqual(before);
      }),
    );

    test(
      `it should set yarnPath when using '--only-if-needed' even if yarnPath is set outside of the project`,
      makeTemporaryEnv({}, {
        env: {COREPACK_ROOT: undefined},
      }, async ({path, run, source}) => {
        await run(`set`, `version`, `self`);
        await check(path, {corepackVersion: /[0-9]+\./, usePath: true});

        const projectDir = ppath.join(path, `project`);
        await xfs.mkdirPromise(projectDir);
        await xfs.writeJsonPromise(ppath.join(projectDir, Filename.manifest), {});
        await xfs.writeFilePromise(ppath.join(projectDir, Filename.lockfile), ``);

        await run(`set`, `version`, `self`, `--only-if-needed`, {cwd: projectDir});
        await check(projectDir, {corepackVersion: /[0-9]+\./, usePath: true});
      }),
    );
  });
});

async function check(path: PortablePath, checks: {corepackVersion: string | RegExp, usePath: boolean}) {
  const releasesPath = ppath.join(path, `.yarn/releases`);
  const yarnrcPath = ppath.join(path, Filename.rc);
  const manifestPath = ppath.join(path, Filename.manifest);

  let releases: Array<string> | null;
  try {
    releases = await xfs.readdirPromise(releasesPath);
  } catch (err) {
    if (err.code === `ENOENT`) {
      releases = null;
    } else {
      throw err;
    }
  }

  let yarnrcFile;
  try {
    yarnrcFile = await xfs.readFilePromise(yarnrcPath, `utf8`);
  } catch (err) {
    if (err.code === `ENOENT`) {
      yarnrcFile = ``;
    } else {
      throw err;
    }
  }

  if (checks.usePath)
    expect(releases).toHaveLength(1);
  else
    expect(releases).toEqual(null);

  if (checks.usePath)
    expect(yarnrcFile).toMatch(yarnrcRegexp);
  else
    expect(yarnrcFile).not.toMatch(yarnrcRegexp);

  await expect(xfs.readJsonPromise(manifestPath)).resolves.toMatchObject({
    packageManager: checks.corepackVersion instanceof RegExp
      ? expect.stringMatching(`yarn@${checks.corepackVersion.source}`)
      : `yarn@${checks.corepackVersion}`,
  });
}
