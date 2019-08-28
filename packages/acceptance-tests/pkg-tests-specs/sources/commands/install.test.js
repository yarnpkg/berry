import {xfs} from '@yarnpkg/fslib';

const {
  fs: {writeJson},
} = require('pkg-tests-core');

describe(`Commands`, () => {
  describe(`install`, () => {
    test(
      `it should print the logs to the standard output when using --inline-builds`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps-scripted`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        const {stdout} = await run(`install`, `--inline-builds`);

        await expect(stdout).toMatchSnapshot();
      }),
    );

    test(
      `it should refuse to change the lockfile when using --immutable`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await expect(run(`install`, `--immutable`)).rejects.toThrow(/YN0028/);
      }),
    );

    test(
      `it should accept to add files to the cache when using --immutable without --immutable-cache`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        await xfs.removePromise(`${path}/.yarn/cache`);

        await run(`install`, `--immutable`);
      })
    );

    test(
      `it should refuse to add files to the cache when using --immutable-cache`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await expect(run(`install`, `--immutable-cache`)).rejects.toThrow(/YN0056/);
      })
    );

    test(
      `it should refuse to add files to the cache when using --immutable-cache, even when the lockfile is good`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        await xfs.removePromise(`${path}/.yarn/cache`);

        await expect(run(`install`, `--immutable-cache`)).rejects.toThrow(/YN0056/);
      })
    );

    test(
      `it should refuse to remove files from the cache when using --immutable-cache`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        await xfs.writeFilePromise(`${path}/package.json`, JSON.stringify({
          dependencies: {},
        }, null, 2));

        await expect(run(`install`, `--immutable-cache`)).rejects.toThrow(/YN0056/);
      })
    );

    test(
      `it should validate the cache files against the remote source when using --check-cache`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps`]: `1.0.0`,
          [`no-deps-bins`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        let lockfile = await xfs.readFilePromise(`${path}/yarn.lock`, `utf8`);

        // Switch "no-deps" and "no-deps-bins"
        lockfile = lockfile.replace(/no-deps-bins/g, `NO_DEPS_BINS`);
        lockfile = lockfile.replace(/no-deps/g, `no-deps-bins`);
        lockfile = lockfile.replace(/NO_DEPS_BINS/g, `no-deps`);

        await xfs.writeFilePromise(`${path}/yarn.lock`, lockfile);

        const allFiles = await xfs.readdirPromise(`${path}/.yarn/cache`);
        const zipFiles = allFiles.filter(file => file.endsWith(`.zip`));

        // Just a sanity check, since this test is quite complex
        expect(zipFiles).toHaveLength(2);

        await xfs.movePromise(`${path}/.yarn/cache/${zipFiles[0]}`, `${path}/.yarn/cache/${zipFiles[0]}-tmp`);
        await xfs.movePromise(`${path}/.yarn/cache/${zipFiles[1]}`, `${path}/.yarn/cache/${zipFiles[0]}`);
        await xfs.movePromise(`${path}/.yarn/cache/${zipFiles[0]}-tmp`, `${path}/.yarn/cache/${zipFiles[1]}`);

        // Just checking that the test is properly written: it should pass, because the lockfile checksum will match the tarballs
        await run(`install`, `--immutable`, `--immutable-cache`);

        // But now, --check-cache should redownload the packages and see that the checksums don't match
        await expect(run(`install`, `--check-cache`)).rejects.toThrow(/YN0018/);
      }),
    );

    test(
      "reports warning if published binary field is a path but no package name is set",
      makeTemporaryEnv(
        {
          bin: "./bin/cli.js",
        },
        async ({path, run, source}) => {
          await expect(run(`install`)).resolves.toMatchSnapshot();
        }
      )
    );

    test(
      "displays validation issues of nested workspaces",
      makeTemporaryEnv(
        {
          workspaces: ["packages"],
        },
        async ({path, run, source}) => {
          await writeJson(`${path}/packages/package.json`, {
            workspaces: ["package-a"],
          });
          await writeJson(`${path}/packages/package-a/package.json`, {
            bin: "./bin/cli.js",
          });

          await expect(run(`install`)).resolves.toMatchSnapshot();
        }
      )
    );
  });
});
