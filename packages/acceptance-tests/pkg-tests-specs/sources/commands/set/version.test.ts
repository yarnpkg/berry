import {xfs, ppath, PortablePath, Filename} from '@yarnpkg/fslib';
import {tests}                              from 'pkg-tests-core';

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

    describe(`--from-registry`, () => {
      test(
        `it should fetch an exact version from a custom registry via --from-registry`,
        makeTemporaryEnv({}, {
          env: {COREPACK_ROOT: undefined},
        }, async ({path, run, source}) => {
          const registryUrl = await tests.startPackageServer();
          const {stdout} = await run(`set`, `version`, `4.0.0`, `--from-registry`, registryUrl);
          expect(stdout).toContain(`Downloading @yarnpkg/cli-dist@4.0.0 from`);
          expect(stdout).toContain(`registry.example.org`);
          expect(stdout).not.toContain(`repo.yarnpkg.com`);
          await check(path, {corepackVersion: `4.0.0`, usePath: true});
        }),
      );

      test(
        `it should fetch an exact version from a custom registry via config`,
        makeTemporaryEnv({}, {
          env: {COREPACK_ROOT: undefined},
        }, async ({path, run, source}) => {
          const registryUrl = await tests.startPackageServer();
          const {stdout} = await run(`set`, `version`, `4.0.0`, {
            env: {YARN_VERSION_NPM_REGISTRY_SERVER: registryUrl},
          });
          expect(stdout).toContain(`Downloading @yarnpkg/cli-dist@4.0.0 from`);
          expect(stdout).toContain(`registry.example.org`);
          expect(stdout).not.toContain(`repo.yarnpkg.com`);
          await check(path, {corepackVersion: `4.0.0`, usePath: true});
        }),
      );

      test(
        `it should resolve a semver range from the custom registry`,
        makeTemporaryEnv({}, {
          env: {COREPACK_ROOT: undefined},
        }, async ({path, run, source}) => {
          const registryUrl = await tests.startPackageServer();
          const {stdout} = await run(`set`, `version`, `4.x`, `--from-registry`, registryUrl);
          expect(stdout).toContain(`Downloading @yarnpkg/cli-dist@4.1.0 from`);
          expect(stdout).toContain(`registry.example.org`);
          expect(stdout).not.toContain(`repo.yarnpkg.com`);
          await check(path, {corepackVersion: `4.1.0`, usePath: true});
        }),
      );

      test(
        `it should error when using --from-registry with tag specifiers`,
        makeTemporaryEnv({}, {
          env: {COREPACK_ROOT: undefined},
        }, async ({path, run, source}) => {
          const registryUrl = await tests.startPackageServer();
          await expect(run(`set`, `version`, `stable`, `--from-registry`, registryUrl)).rejects.toThrow(/--from-registry flag can only be used with Yarn 2\+ semver versions or ranges/);
        }),
      );

      test(
        `it should error when using --from-registry with classic`,
        makeTemporaryEnv({}, {
          env: {COREPACK_ROOT: undefined},
        }, async ({path, run, source}) => {
          const registryUrl = await tests.startPackageServer();
          await expect(run(`set`, `version`, `classic`, `--from-registry`, registryUrl)).rejects.toThrow(/--from-registry flag can only be used with Yarn 2\+ semver versions or ranges/);
        }),
      );

      test(
        `it should error when using --from-registry with Yarn 1.x versions`,
        makeTemporaryEnv({}, {
          env: {COREPACK_ROOT: undefined},
        }, async ({path, run, source}) => {
          const registryUrl = await tests.startPackageServer();
          await expect(run(`set`, `version`, `1.22.1`, `--from-registry`, registryUrl)).rejects.toThrow(/--from-registry flag can only be used with Yarn 2\+ semver versions or ranges/);
        }),
      );

      test(
        `it should error when using --from-registry with URL specifiers`,
        makeTemporaryEnv({}, {
          env: {COREPACK_ROOT: undefined},
        }, async ({path, run, source}) => {
          const registryUrl = await tests.startPackageServer();
          await expect(run(`set`, `version`, `https://example.com/yarn.js`, `--from-registry`, registryUrl)).rejects.toThrow(/--from-registry flag can only be used with Yarn 2\+ semver versions or ranges/);
        }),
      );

      test(
        `it should error when using --from-registry with file path specifiers`,
        makeTemporaryEnv({}, {
          env: {COREPACK_ROOT: undefined},
        }, async ({path, run, source}) => {
          const registryUrl = await tests.startPackageServer();
          await expect(run(`set`, `version`, `./yarn.cjs`, `--from-registry`, registryUrl)).rejects.toThrow(/--from-registry flag can only be used with Yarn 2\+ semver versions or ranges/);
        }),
      );

      test(
        `it should error when using --from-registry with self`,
        makeTemporaryEnv({}, {
          env: {COREPACK_ROOT: undefined},
        }, async ({path, run, source}) => {
          const registryUrl = await tests.startPackageServer();
          await expect(run(`set`, `version`, `self`, `--from-registry`, registryUrl)).rejects.toThrow(/--from-registry flag can only be used with Yarn 2\+ semver versions or ranges/);
        }),
      );

      test(
        `it should silently ignore versionNpmRegistryServer for incompatible specifiers`,
        makeTemporaryEnv({}, {
          env: {COREPACK_ROOT: undefined},
        }, async ({path, run, source}) => {
          await run(`set`, `version`, `self`, {
            env: {YARN_VERSION_NPM_REGISTRY_SERVER: `https://bogus.invalid`},
          });
          await check(path, {corepackVersion: /[0-9]+\./, usePath: true});
        }),
      );

      test(
        `it should use --from-registry flag over versionNpmRegistryServer config`,
        makeTemporaryEnv({}, {
          env: {COREPACK_ROOT: undefined},
        }, async ({path, run, source}) => {
          const registryUrl = await tests.startPackageServer();
          const {stdout} = await run(`set`, `version`, `4.0.0`, `--from-registry`, registryUrl, {
            env: {YARN_VERSION_NPM_REGISTRY_SERVER: `https://bogus.invalid`},
          });
          expect(stdout).toContain(`registry.example.org`);
          expect(stdout).not.toContain(`bogus.invalid`);
          await check(path, {corepackVersion: `4.0.0`, usePath: true});
        }),
      );

      test(
        `it should error when using --from-registry with a 1.x range`,
        makeTemporaryEnv({}, {
          env: {COREPACK_ROOT: undefined},
        }, async ({path, run, source}) => {
          const registryUrl = await tests.startPackageServer();
          await expect(run(`set`, `version`, `1.x`, `--from-registry`, registryUrl)).rejects.toThrow(/--from-registry flag can only be used with Yarn 2\+ semver versions or ranges/);
        }),
      );

      test(
        `it should error when no versions match the range on the registry`,
        makeTemporaryEnv({}, {
          env: {COREPACK_ROOT: undefined},
        }, async ({path, run, source}) => {
          const registryUrl = await tests.startPackageServer();
          await expect(run(`set`, `version`, `99.x`, `--from-registry`, registryUrl)).rejects.toThrow(/No matching version of @yarnpkg\/cli-dist found for range/);
        }),
      );

      test(
        `it should error when the exact version does not exist on the registry`,
        makeTemporaryEnv({}, {
          env: {COREPACK_ROOT: undefined},
        }, async ({path, run, source}) => {
          const registryUrl = await tests.startPackageServer();
          await expect(run(`set`, `version`, `4.99.0`, `--from-registry`, registryUrl)).rejects.toThrow();
        }),
      );

      test(
        `it should error when the tarball has no bin.yarn entry in package.json`,
        makeTemporaryEnv({}, {
          env: {COREPACK_ROOT: undefined},
        }, async ({path, run, source}) => {
          const registryUrl = await tests.startPackageServer();
          await expect(run(`set`, `version`, `2.0.0-malformed`, `--from-registry`, registryUrl)).rejects.toThrow(/Could not find a 'bin\.yarn' entry in the @yarnpkg\/cli-dist package\.json/);
        }),
      );

      test(
        `it should error when bin.yarn points to a missing file in the tarball`,
        makeTemporaryEnv({}, {
          env: {COREPACK_ROOT: undefined},
        }, async ({path, run, source}) => {
          const registryUrl = await tests.startPackageServer();
          await expect(run(`set`, `version`, `2.0.0-bad-bin`, `--from-registry`, registryUrl)).rejects.toThrow(/The 'bin\.yarn' entry in @yarnpkg\/cli-dist points to '.*', but this file does not exist in the tarball/);
        }),
      );
    });
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
