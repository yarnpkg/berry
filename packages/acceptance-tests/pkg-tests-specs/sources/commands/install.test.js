import {xfs, ppath} from '@yarnpkg/fslib';

const {
  fs: {writeJson},
} = require(`pkg-tests-core`);

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
      `it should refuse to create a lockfile when using --immutable`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await expect(run(`install`, `--immutable`)).rejects.toThrow(/YN0028/);
      }),
    );

    test(
      `it should refuse to change the lockfile when using --immutable`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await run(`install`);

        await xfs.writeJsonPromise(ppath.join(path, `yarn.lock`), {
          dependencies: {
            [`no-deps`]: `1.0.0`,
          },
        });

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
        },
      }, async ({path, run, source}) => {
        let archiveName1;
        let archiveName2;

        // First we need to detect the name that the true cache archive would have
        {
          await run(`install`);

          const allFiles1 = await xfs.readdirPromise(ppath.join(path, `.yarn/cache`));
          const zipFiles1 = allFiles1.filter(file => file.endsWith(`.zip`));

          // Just a sanity check, since this test is quite complex
          expect(zipFiles1).toHaveLength(1);
          archiveName1 = zipFiles1[0];
        }

        await xfs.writeJsonPromise(ppath.join(path, `package.json`), {
          dependencies: {
            [`no-deps`]: `2.0.0`,
          },
        });

        // Then we install the project with 2.0.0
        {
          await run(`install`);

          const allFiles2 = await xfs.readdirPromise(`${path}/.yarn/cache`);
          const zipFiles2 = allFiles2.filter(file => file.endsWith(`.zip`));

          // Just a sanity check, since this test is quite complex
          expect(zipFiles2).toHaveLength(1);
          archiveName2 = zipFiles2[0];
        }

        // We need to replace the hash in the cache filename, otherwise the cache just won't find the archive
        archiveName1 = archiveName1.replace(/[^-]+$/, archiveName2.match(/[^-]+$/)[0]);

        await xfs.writeJsonPromise(ppath.join(path, `package.json`), {
          dependencies: {
            [`no-deps`]: `1.0.0`,
          },
        });

        // Then we disguise 2.0.0 as 1.0.0. The stored checksum will stay the same.
        {
          const lockfile = await xfs.readFilePromise(`${path}/yarn.lock`, `utf8`);

          // Moves from "2.0.0" to "1.0.0"
          await xfs.writeFilePromise(`${path}/yarn.lock`, lockfile.replace(/2\.0\.0/g, `1.0.0`));

          // Don't forget to rename the archive to match the name the real 1.0.0 would have
          await xfs.movePromise(`${path}/.yarn/cache/${archiveName2}`, `${path}/.yarn/cache/${archiveName1}`);
        }

        // Just checking that the test is properly written: it should pass, because the lockfile checksum will match the tarballs
        await run(`install`, `--immutable`, `--immutable-cache`);

        // But now, --check-cache should redownload the packages and see that the checksums don't match
        await expect(run(`install`, `--check-cache`)).rejects.toThrow(/YN0018/);
      }),
    );

    test(
      `reports warning if published binary field is a path but no package name is set`,
      makeTemporaryEnv(
        {
          bin: `./bin/cli.js`,
        },
        async ({path, run, source}) => {
          await expect(run(`install`)).resolves.toMatchSnapshot();
        }
      )
    );

    test(
      `displays validation issues of nested workspaces`,
      makeTemporaryEnv(
        {
          workspaces: [`packages`],
        },
        async ({path, run, source}) => {
          await writeJson(`${path}/packages/package.json`, {
            workspaces: [`package-a`],
          });
          await writeJson(`${path}/packages/package-a/package.json`, {
            bin: `./bin/cli.js`,
          });

          await expect(run(`install`)).resolves.toMatchSnapshot();
        }
      )
    );
  });
});
