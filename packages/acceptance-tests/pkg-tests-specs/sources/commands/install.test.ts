import {Filename, xfs, ppath, npath} from '@yarnpkg/fslib';
import {tests, misc}                 from 'pkg-tests-core';

describe(`Commands`, () => {
  describe(`install`, () => {
    test(
      `it should print regular messages as JSON items when using --json`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const {stdout} = await run(`install`, `--json`);

        expect(misc.parseJsonStream(stdout)).toEqual([{
          data: `Yarn 0.0.0`,
          displayName: `YN0000`,
          indent: `· `,
          name: 0,
          type: `info`,
        }, {
          data: `┌ Resolution step`,
          displayName: `YN0000`,
          indent: ``,
          name: null,
          type: `info`,
        }, {
          data: `└ Completed`,
          displayName: `YN0000`,
          indent: ``,
          name: null,
          type: `info`,
        }, {
          data: `┌ Fetch step`,
          displayName: `YN0000`,
          indent: ``,
          name: null,
          type: `info`,
        }, {
          data: `└ Completed`,
          displayName: `YN0000`,
          indent: ``,
          name: null,
          type: `info`,
        }, {
          data: `┌ Link step`,
          displayName: `YN0000`,
          indent: ``,
          name: null,
          type: `info`,
        }, {
          data: `└ Completed`,
          displayName: `YN0000`,
          indent: ``,
          name: null,
          type: `info`,
        }, {
          data: `Done`,
          displayName: `YN0000`,
          indent: `· `,
          name: 0,
          type: `info`,
        }]);
      }),
    );

    test(
      `it should print the logs to the standard output when using --inline-builds`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps-scripted`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        const {stdout} = await run(`install`, `--inline-builds`);

        expect(stdout).toContain(`no-deps-scripted@npm:1.0.0 must be built because it never has been before`);
        expect(stdout).toContain(`STDOUT preinstall out`);
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

        expect(stdout).not.toContain(`no-deps-scripted@npm:1.0.0 must be built because it never has been before`);
        expect(stdout).not.toContain(`STDOUT preinstall out`);
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
      `it should update the lockfile when using --refresh-lockfile`,
      makeTemporaryEnv({
        dependencies: {
          [`one-fixed-dep`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        // Sanity check
        await expect(source(`require('one-fixed-dep')`)).resolves.toMatchObject({
          name: `one-fixed-dep`,
          version: `1.0.0`,
          dependencies: {
            [`no-deps`]: {
              name: `no-deps`,
              version: `1.0.0`,
            },
          },
        });

        const lockfilePath = ppath.join(path, Filename.lockfile);
        const lockfileContent = await xfs.readFilePromise(lockfilePath, `utf8`);
        const modifiedLockfile = lockfileContent.replace(/no-deps: "npm:1.0.0"/, `no-deps: "npm:2.0.0"`);
        await xfs.writeFilePromise(lockfilePath, modifiedLockfile);

        await run(`install`);

        // Sanity check
        await expect(source(`require('one-fixed-dep')`)).resolves.toMatchObject({
          name: `one-fixed-dep`,
          version: `1.0.0`,
          dependencies: {
            [`no-deps`]: {
              name: `no-deps`,
              version: `2.0.0`,
            },
          },
        });

        await run(`install`, `--refresh-lockfile`);

        // Actual test
        await expect(source(`require('one-fixed-dep')`)).resolves.toMatchObject({
          name: `one-fixed-dep`,
          version: `1.0.0`,
          dependencies: {
            [`no-deps`]: {
              name: `no-deps`,
              version: `1.0.0`,
            },
          },
        });
      }),
    );

    test(
      `it should block invalid lockfiles when using --refresh-lockfile with --immutable`,
      makeTemporaryEnv({
        dependencies: {
          [`one-fixed-dep`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        const lockfilePath = ppath.join(path, Filename.lockfile);
        const lockfileContent = await xfs.readFilePromise(lockfilePath, `utf8`);
        const modifiedLockfile = lockfileContent.replace(/no-deps: "npm:1.0.0"/, `no-deps: "npm:2.0.0"`);
        await xfs.writeFilePromise(lockfilePath, modifiedLockfile);

        await run(`install`);

        await expect(run(`install`, `--immutable`, `--refresh-lockfile`)).rejects.toThrow(/YN0028/);
      }),
    );

    test(
      `it should enable --refresh-lockfile --immutable by default in public PR CIs`,
      makeTemporaryEnv({
        dependencies: {
          [`one-fixed-dep`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        const lockfilePath = ppath.join(path, Filename.lockfile);
        const lockfileContent = await xfs.readFilePromise(lockfilePath, `utf8`);
        const modifiedLockfile = lockfileContent.replace(/no-deps: "npm:1.0.0"/, `no-deps: "npm:2.0.0"`);
        await xfs.writeFilePromise(lockfilePath, modifiedLockfile);

        const eventPath = ppath.join(path, `github-event-file.json`);
        await xfs.writeJsonPromise(eventPath, {
          repository: {
            private: false,
          },
        });

        await run(`install`);

        await expect(run(`install`, {
          env: {
            GITHUB_ACTIONS: `true`,
            GITHUB_EVENT_NAME: `pull_request`,
            GITHUB_EVENT_PATH: npath.fromPortablePath(eventPath),
          },
        })).rejects.toThrow(/YN0028/);
      }),
    );

    test(
      `it should not enable --refresh-lockfile --immutable in private PR CIs`,
      makeTemporaryEnv({
        dependencies: {
          [`one-fixed-dep`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        const lockfilePath = ppath.join(path, Filename.lockfile);
        const lockfileContent = await xfs.readFilePromise(lockfilePath, `utf8`);
        const modifiedLockfile = lockfileContent.replace(/no-deps: "npm:1.0.0"/, `no-deps: "npm:2.0.0"`);
        await xfs.writeFilePromise(lockfilePath, modifiedLockfile);

        const eventPath = ppath.join(path, `github-event-file.json`);
        await xfs.writeJsonPromise(eventPath, {
          repository: {
            private: true,
          },
        });

        await run(`install`);

        await run(`install`, {
          env: {
            GITHUB_ACTIONS: `true`,
            GITHUB_EVENT_NAME: `pull_request`,
            GITHUB_EVENT_PATH: npath.fromPortablePath(eventPath),
          },
        });
      }),
    );

    test(
      `it should not enable --refresh-lockfile --immutable if the GH environment file is missing`,
      makeTemporaryEnv({
        dependencies: {
          [`one-fixed-dep`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        const lockfilePath = ppath.join(path, Filename.lockfile);
        const lockfileContent = await xfs.readFilePromise(lockfilePath, `utf8`);
        const modifiedLockfile = lockfileContent.replace(/no-deps: "npm:1.0.0"/, `no-deps: "npm:2.0.0"`);
        await xfs.writeFilePromise(lockfilePath, modifiedLockfile);

        const eventPath = ppath.join(path, `github-event-file.json`);

        await run(`install`);

        await run(`install`, {
          env: {
            GITHUB_ACTIONS: `true`,
            GITHUB_EVENT_NAME: `pull_request`,
            GITHUB_EVENT_PATH: npath.fromPortablePath(eventPath),
          },
        });
      }),
    );

    test(
      `it should not enable --refresh-lockfile --immutable if the GH environment file is weird`,
      makeTemporaryEnv({
        dependencies: {
          [`one-fixed-dep`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        const lockfilePath = ppath.join(path, Filename.lockfile);
        const lockfileContent = await xfs.readFilePromise(lockfilePath, `utf8`);
        const modifiedLockfile = lockfileContent.replace(/no-deps: "npm:1.0.0"/, `no-deps: "npm:2.0.0"`);
        await xfs.writeFilePromise(lockfilePath, modifiedLockfile);

        const eventPath = ppath.join(path, `github-event-file.json`);
        await xfs.writeJsonPromise(eventPath, {
          hello: `world`,
        });

        await run(`install`);

        await run(`install`, {
          env: {
            GITHUB_ACTIONS: `true`,
            GITHUB_EVENT_NAME: `pull_request`,
            GITHUB_EVENT_PATH: npath.fromPortablePath(eventPath),
          },
        });
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

        await xfs.removePromise(ppath.join(path, `.yarn/cache`));

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
        await xfs.mkdirPromise(ppath.join(path, `.yarn/cache`), {recursive: true});
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
        await xfs.removePromise(ppath.join(path, `.yarn/cache`));
        await xfs.mkdirPromise(ppath.join(path, `.yarn/cache`), {recursive: true});

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

        await xfs.writeJsonPromise(ppath.join(path, Filename.manifest), {
          dependencies: {},
        });

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
        let archiveName1: Filename;
        let archiveName2: Filename;

        // First we need to detect the name that the true cache archive would have
        {
          await run(`install`);

          const allFiles1 = await xfs.readdirPromise(ppath.join(path, `.yarn/cache`));
          const zipFiles1 = allFiles1.filter(file => file.endsWith(`.zip`));

          // Just a sanity check, since this test is quite complex
          expect(zipFiles1).toHaveLength(1);
          archiveName1 = zipFiles1[0];
        }

        await xfs.writeJsonPromise(ppath.join(path, Filename.manifest), {
          dependencies: {
            [`no-deps`]: `2.0.0`,
          },
        });

        // Then we install the project with 2.0.0
        {
          await run(`install`);

          const allFiles2 = await xfs.readdirPromise(ppath.join(path, `.yarn/cache`));
          const zipFiles2 = allFiles2.filter(file => file.endsWith(`.zip`));

          // Just a sanity check, since this test is quite complex
          expect(zipFiles2).toHaveLength(1);
          archiveName2 = zipFiles2[0];
        }

        // We need to replace the hash in the cache filename, otherwise the cache just won't find the archive
        archiveName1 = archiveName1.replace(/[^-]+$/, archiveName2.match(/[^-]+$/)![0]) as Filename;

        await xfs.writeJsonPromise(ppath.join(path, Filename.manifest), {
          dependencies: {
            [`no-deps`]: `1.0.0`,
          },
        });

        // Then we disguise 2.0.0 as 1.0.0. The stored checksum will stay the same.
        {
          const lockfile = await xfs.readFilePromise(ppath.join(path, Filename.lockfile), `utf8`);

          // Moves from "2.0.0" to "1.0.0"
          await xfs.writeFilePromise(ppath.join(path, Filename.lockfile), lockfile.replace(/2\.0\.0/g, `1.0.0`));

          // Don't forget to rename the archive to match the name the real 1.0.0 would have
          await xfs.movePromise(ppath.join(path, `.yarn/cache`, archiveName2), ppath.join(path, `.yarn/cache`, archiveName1));
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
          const {stdout} = await run(`install`);

          expect(stdout).toContain(`root-workspace-0b6124: String bin field, but no attached package name`);
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
          await xfs.mkdirPromise(ppath.join(path, `packages`), {recursive: true});
          await xfs.mkdirPromise(ppath.join(path, `packages/package-a`), {recursive: true});

          await xfs.writeJsonPromise(ppath.join(path, `packages`, Filename.manifest), {
            workspaces: [`package-a`],
          });

          await xfs.writeJsonPromise(ppath.join(path, `packages/package-a`, Filename.manifest), {
            bin: `./bin/cli.js`,
          });

          await expect(run(`install`)).resolves.toMatchObject({
            stdout: expect.stringContaining(`package-a-ddd35d: String bin field, but no attached package name`),
          });
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
          await xfs.mkdirPromise(ppath.join(path, `workspace`));

          await xfs.writeJsonPromise(ppath.join(path, `workspace`, Filename.manifest), {
            name: `foo`,
            scripts: {
              postinstall: `echo "foo"`,
            },
            peerDependencies: {
              'no-deps': `*`,
            },
          });

          const {stdout} = await run(`install`);

          expect(stdout).toContain(`foo@workspace:workspace must be built`);
          expect(stdout).not.toMatch(/foo@virtual:.* must be built/);
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
      `should not mark package as built if any of its scripts fails`,
      makeTemporaryEnv(
        {
          scripts: {
            preinstall: `echo 'foo'`,
            postinstall: `exit 1`,
          },
        },
        async ({path, run, source}) => {
          await expect(run(`install`, `--inline-builds`)).rejects.toMatchObject({
            code: 1,
            stdout: expect.stringContaining(`foo`),
          });

          await expect(run(`install`, `--inline-builds`)).rejects.toMatchObject({
            code: 1,
            stdout: expect.stringContaining(`foo`),
          });
        },
      ),
    );

    test(
      `should wait for direct dependencies to finish building`,
      makeTemporaryMonorepoEnv(
        {
          workspaces: [`packages/*`],
        },
        {
          'packages/foo': {
            name: `foo`,
            dependencies: {
              bar: `workspace:*`,
            },
            scripts: {
              postinstall: `node -e "require('bar')"`,
            },
          },
          'packages/bar': {
            name: `bar`,
            scripts: {
              postinstall: `sleep 5 && node -e "fs.writeFileSync('index.js', '')"`,
            },
          },
        },
        async ({path, run, source}) => {
          await expect(run(`install`, `--inline-builds`)).resolves.toMatchObject({
            code: 0,
          });
        },
      ),
    );

    test(
      `should wait for indirect dependencies to finish building`,
      makeTemporaryMonorepoEnv(
        {
          workspaces: [`packages/*`],
        },
        {
          'packages/foo': {
            name: `foo`,
            dependencies: {
              bar: `workspace:*`,
            },
            scripts: {
              postinstall: `node -e "require('bar')"`,
            },
          },
          'packages/bar': {
            name: `bar`,
            dependencies: {
              baz: `workspace:*`,
            },
          },
          'packages/baz': {
            name: `baz`,
            scripts: {
              postinstall: `sleep 5 && node -e "fs.writeFileSync('index.js', '')"`,
            },
          },
        },
        async ({path, run, source}) => {
          await xfs.writeFilePromise(ppath.join(path, `packages/bar/index.js`), `require('baz')`);
          await expect(run(`install`, `--inline-builds`)).resolves.toMatchObject({
            code: 0,
          });
        },
      ),
    );

    test(
      `should wait for virtual workspace dependencies to finish building`,
      makeTemporaryMonorepoEnv(
        {
          workspaces: [`packages/*`],
        },
        {
          'packages/foo': {
            name: `foo`,
            dependencies: {
              bar: `workspace:*`,
            },
            scripts: {
              postinstall: `node -e "require('bar')"`,
            },
          },
          'packages/bar': {
            name: `bar`,
            peerDependencies: {
              'no-deps': `*`,
            },
            scripts: {
              postinstall: `sleep 5 && node -e "fs.writeFileSync('index.js', '')"`,
            },
          },
        },
        async ({path, run, source}) => {
          await expect(run(`install`, `--inline-builds`)).resolves.toMatchObject({
            code: 0,
          });
        },
      ),
    );

    test(
      `should support a self-referencing build dependency`,
      makeTemporaryEnv(
        {
          name: `foo`,
          dependencies: {
            'no-deps': `1.0.0`,
          },
          scripts: {
            postinstall: `echo foo`,
          },
        },
        async ({path, run, source}) => {
          await xfs.writeJsonPromise(ppath.join(path, Filename.rc), {
            packageExtensions: {
              'no-deps@*': {
                dependencies: {
                  foo: `workspace:*`,
                },
              },
            },
          });

          await expect(run(`install`, `--inline-builds`)).resolves.toMatchObject({
            code: 0,
          });
        },
      ),
    );

    test(
      `should support a self-referencing virtual workspace build dependency`,
      makeTemporaryMonorepoEnv(
        {
          workspaces: [`packages/*`],
        },
        {
          'packages/foo': {
            name: `foo`,
            peerDependencies: {
              'no-deps': `1.0.0`,
            },
            dependencies: {
              bar: `workspace:*`,
            },
            scripts: {
              postinstall: `echo foo`,
            },
          },
          'packages/bar': {
            name: `bar`,
            dependencies: {
              foo: `workspace:*`,
            },
          },
        },
        async ({path, run, source}) => {
          await expect(run(`install`, `--inline-builds`)).resolves.toMatchObject({
            code: 0,
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
        await xfs.writeJsonPromise(ppath.join(path, Filename.rc), {
          enableScripts: false,
        });

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
        await xfs.writeJsonPromise(ppath.join(path, Filename.rc), {
          enableScripts: false,
        });

        const {stdout} = await run(`install`, `--inline-builds`);
        expect(stdout).toMatch(/YN0005/g);
        expect(stdout).not.toMatch(/YN0004/g);
      }),
    );

    test(
      `it should throw a proper error if not find any locator`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await xfs.mkdirPromise(ppath.join(path, `non-workspace`));

        await xfs.writeJsonPromise(ppath.join(path, `non-workspace`, Filename.manifest), {
          name: `non-workspace`,
        });

        await expect(run(`install`, {cwd: ppath.join(path, `non-workspace`)})).rejects.toMatchObject({
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
        await run(`install`);

        await xfs.writeJsonPromise(ppath.join(path, Filename.manifest), {
          dependencies: {
            [`one-fixed-dep`]: `1.0.0`,
            [`no-deps`]: `2.0.0`,
          },
        });

        await xfs.removePromise(ppath.join(path, `.yarn/cache`));
        await xfs.mkdirPromise(ppath.join(path, `.yarn/cache`), {recursive: true});

        await expect(tests.startRegistryRecording(async () => {
          await run(`install`, `--mode=update-lockfile`);
        })).resolves.toEqual([{
          type: `packageTarball`,
          scope: undefined,
          localName: `no-deps`,
          version: `2.0.0`,
        }]);

        const cacheAfter = await xfs.readdirPromise(ppath.join(path, `.yarn/cache`));
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
        await xfs.writeJsonPromise(ppath.join(path, Filename.rc), {
          enableImmutableInstalls: true,
        });

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

    test(`it should exit with an error code after an unexpected empty event loop`,
      makeTemporaryEnv({}, async ({path, run}) => {
        await xfs.writeFilePromise(ppath.join(path, `plugin.cjs`), `
module.exports = {
  name: 'test',
  factory() {
    return {
      hooks: {
        afterAllInstalled: () => new Promise(() => {}),
      },
    };
  },
};
`);
        await xfs.writeJsonPromise(ppath.join(path, Filename.rc), {
          plugins: [`./plugin.cjs`],
        });

        await expect(run(`install`)).rejects.toMatchObject({
          code: 42,
          stdout: expect.stringContaining(`Yarn is terminating due to an unexpected empty event loop`),
        });
      }),
    );
  });
});
