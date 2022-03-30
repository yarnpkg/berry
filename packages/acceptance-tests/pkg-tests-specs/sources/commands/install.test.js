import {Filename, xfs, ppath} from '@yarnpkg/fslib';

const {
  fs: {writeJson, writeFile},
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
      `it should skip build scripts when using --mode=skip-build`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps-scripted`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        const {stdout} = await run(`install`, `--inline-builds`, `--mode=skip-build`);

        await expect(stdout).toMatchSnapshot();
      }),
    );

    test(
      `it shouldn't impact how artifacts are generated when using --mode=skip-build`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps-scripted`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        const pnpPath = ppath.join(path, Filename.pnpCjs);

        await run(`install`);
        const pnpFileWithBuilds = await xfs.readFilePromise(pnpPath);

        await xfs.removePromise(pnpPath);

        await run(`install`, `--mode=skip-build`);
        const pnpFileWithoutBuilds = await xfs.readFilePromise(pnpPath);

        expect(pnpFileWithBuilds).toEqual(pnpFileWithoutBuilds);
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
      }),
    );

    test(
      `it should refuse to create a cache when using --immutable-cache`,
      makeTemporaryEnv({
        dependencies: {},
      }, async ({path, run, source}) => {
        await expect(run(`install`, `--immutable-cache`)).rejects.toThrowError(/Cache path does not exist/);
      }),
    );

    test(
      `it should refuse to add files to the cache when using --immutable-cache`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        // Ensure the cache directory exists
        await xfs.mkdirPromise(`${path}/.yarn/cache`, {recursive: true});
        await expect(run(`install`, `--immutable-cache`)).rejects.toThrow(/YN0056/);
      }),
    );

    test(
      `it should refuse to add files to the cache when using --immutable-cache, even when the lockfile is good`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        // Empty, rather than remove the cache
        await xfs.removePromise(`${path}/.yarn/cache`);
        await xfs.mkdirPromise(`${path}/.yarn/cache`, {recursive: true});

        await expect(run(`install`, `--immutable-cache`)).rejects.toThrow(/YN0056/);
      }),
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
      }),
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
        },
      ),
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
        },
      ),
    );

    test(
      `should not build virtual workspaces`,
      makeTemporaryEnv(
        {
          workspaces: [`workspace`],
          dependencies: {
            foo: `workspace:*`,
            'no-deps': `*`,
          },
        },
        async ({path, run, source}) => {
          await xfs.mkdirPromise(`${path}/workspace`);
          await xfs.writeJsonPromise(`${path}/workspace/package.json`, {
            name: `foo`,
            scripts: {
              postinstall: `echo "foo"`,
            },
            peerDependencies: {
              'no-deps': `*`,
            },
          });

          await expect(run(`install`)).resolves.toMatchSnapshot();
        },
      ),
    );

    test(
      `should only print one error message for failed builds`,
      makeTemporaryEnv(
        {
          scripts: {
            postinstall: `exit 1`,
          },
        },
        async ({path, run, source}) => {
          let code;
          let stdout;

          try {
            ({code, stdout} = await run(`install`));
          } catch (error) {
            ({code, stdout} = error);
          }

          expect(code).toEqual(1);
          expect(stdout.match(/YN0009/g).length).toEqual(1);
        },
      ),
    );

    test(
      `should not continue running build scripts if one of them fails`,
      makeTemporaryEnv(
        {
          scripts: {
            preinstall: `exit 1`,
            postinstall: `echo 'foo'`,
          },
        },
        async ({path, run, source}) => {
          await expect(run(`install`, `--inline-builds`)).rejects.toMatchObject({
            code: 1,
            stdout: expect.not.stringContaining(`foo`),
          });
        },
      ),
    );

    test(
      `it should print a warning when using \`enableScripts: false\``,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps-scripted`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await writeFile(`${path}/.yarnrc.yml`, `enableScripts: false`);
        const {stdout} = await run(`install`, `--inline-builds`);
        expect(stdout).toMatch(/YN0004/g);
      }),
    );

    test(
      `it should print an info when \`dependenciesMeta[].built: false\`, even when using using \`enableScripts: false\``,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps-scripted`]: `1.0.0`,
        },
        dependenciesMeta: {
          'no-deps-scripted': {
            built: false,
          },
        },
      }, async ({path, run, source}) => {
        await writeFile(`${path}/.yarnrc.yml`, `enableScripts: false`);
        const {stdout} = await run(`install`, `--inline-builds`);
        expect(stdout).toMatch(/YN0005/g);
        expect(stdout).not.toMatch(/YN0004/g);
      }),
    );

    test(
      `it should throw a proper error if not find any locator`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await xfs.mkdirPromise(`${path}/non-workspace`);
        await xfs.writeJsonPromise(`${path}/non-workspace/package.json`, {
          name: `non-workspace`,
        });

        await expect(run(`install`, {cwd: `${path}/non-workspace`})).rejects.toMatchObject({
          code: 1,
          stdout: expect.stringMatching(/The nearest package directory \(.+\) doesn't seem to be part of the project declared in .+\./g),
        });
      }),
    );

    test(
      `it should fetch only required packages when using \`--mode=update-lockfile\``,
      makeTemporaryEnv({
        dependencies: {
          [`one-fixed-dep`]: `1.0.0`,
          [`no-deps`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`install`, `--mode=update-lockfile`);

        const cacheBefore = await xfs.readdirPromise(`${path}/.yarn/cache`);
        expect(cacheBefore.find(entry => entry.includes(`one-fixed-dep-npm-1.0.0`))).toBeDefined();
        expect(cacheBefore.find(entry => entry.includes(`no-deps-npm-1.0.0`))).toBeDefined();

        await xfs.writeJsonPromise(`${path}/package.json`, {
          dependencies: {
            [`one-fixed-dep`]: `1.0.0`,
            [`no-deps`]: `2.0.0`,
          },
        });
        await xfs.removePromise(`${path}/.yarn/cache`);
        await xfs.mkdirPromise(`${path}/.yarn/cache`, {recursive: true});

        const {code, stdout, stderr} = await run(`install`, `--mode=update-lockfile`);
        await expect({code, stdout, stderr}).toMatchSnapshot();

        const cacheAfter = await xfs.readdirPromise(`${path}/.yarn/cache`);
        expect(cacheAfter.find(entry => entry.includes(`one-fixed-dep-npm-1.0.0`))).toBeUndefined();
        expect(cacheAfter.find(entry => entry.includes(`no-deps-npm-1.0.0`))).toBeUndefined();
        expect(cacheAfter.find(entry => entry.includes(`no-deps-npm-2.0.0`))).toBeDefined();
      }),
    );

    test(
      `it should disable immutable installs when using \`--mode=update-lockfile\``,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps`]: `1.0.0`,
        },
      }, async ({path, run}) => {
        await xfs.writeFilePromise(`${path}/${Filename.rc}`, `enableImmutableInstalls: true`);

        const {stdout} = await run(`install`, `--mode=update-lockfile`);
        expect(stdout).not.toMatch(/YN0028/g);
      }),
    );

    test(
      `it should throw when \`--immutable\` or \`--immutable-cache\` is specified with \`--mode=update-lockfile\``,
      makeTemporaryEnv({}, async ({path, run}) => {
        await expect(run(`install`, `--mode=update-lockfile`, `--immutable`)).rejects.toMatchObject({
          code: 1,
          stdout: expect.stringMatching(/--immutable and --immutable-cache cannot be used with --mode=update-lockfile/g),
        });
        await expect(run(`install`, `--mode=update-lockfile`, `--immutable-cache`)).rejects.toMatchObject({
          code: 1,
          stdout: expect.stringMatching(/--immutable and --immutable-cache cannot be used with --mode=update-lockfile/g),
        });
        await expect(run(`install`, `--mode=update-lockfile`, `--immutable`, `--immutable-cache`)).rejects.toMatchObject({
          code: 1,
          stdout: expect.stringMatching(/--immutable and --immutable-cache cannot be used with --mode=update-lockfile/g),
        });
      }),
    );
  });
});
