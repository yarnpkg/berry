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
        env: {COREPACK_ROOT: `/path/to/corepack`},
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
        const yarnIndirection = ppath.join(path, `custom-yarn.cjs` as Filename);
        await xfs.writeFilePromise(yarnIndirection, ``);

        await expect(run(`set`, `version`, yarnIndirection, `--no-yarn-path`)).rejects.toThrow();
      }),
    );

    test(
      `it should set yarnPath if the version is an arbitrary file`,
      makeTemporaryEnv({}, {
        env: {COREPACK_ROOT: undefined},
      }, async ({path, run, source}) => {
        const yarnIndirection = ppath.join(path, `custom-yarn.cjs` as Filename);
        await xfs.writeFilePromise(yarnIndirection, ``);

        await run(`set`, `version`, yarnIndirection);
        await check(path, {corepackVersion: /[0-9]+\./, usePath: true});
      }),
    );
  });
});

async function check(path: PortablePath, checks: {corepackVersion: string | RegExp, usePath: boolean}) {
  const releasesPath = ppath.join(path, `.yarn/releases` as PortablePath);
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
