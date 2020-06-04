import {xfs} from '@yarnpkg/fslib';

const {
  tests: {getPackageDirectoryPath},
  yarn: {readManifest},
} = require(`pkg-tests-core`);
const {parseSyml} = require(`@yarnpkg/parsers`);

describe(`Commands`, () => {
  describe(`add`, () => {
    test(
      `it should add a new regular dependency to the current project (explicit semver)`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await run(`add`, `no-deps@1.0.0`);

        await expect(xfs.readJsonPromise(`${path}/package.json`)).resolves.toMatchObject({
          dependencies: {
            [`no-deps`]: `1.0.0`,
          },
        });
      }),
    );

    test(
      `it should add a new regular dependency to the current project (implicit caret)`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await run(`add`, `no-deps`);

        await expect(xfs.readJsonPromise(`${path}/package.json`)).resolves.toMatchObject({
          dependencies: {
            [`no-deps`]: `^2.0.0`,
          },
        });
      }),
    );

    test(
      `it should add a new regular dependency to the current project (implicit tilde)`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await run(`add`, `no-deps`, `-T`);

        await expect(xfs.readJsonPromise(`${path}/package.json`)).resolves.toMatchObject({
          dependencies: {
            [`no-deps`]: `~2.0.0`,
          },
        });
      }),
    );

    test(
      `it should add a new regular dependency to the current project (implicit exact)`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await run(`add`, `no-deps`, `-E`);

        await expect(xfs.readJsonPromise(`${path}/package.json`)).resolves.toMatchObject({
          dependencies: {
            [`no-deps`]: `2.0.0`,
          },
        });
      }),
    );

    test(
      `it should add a new regular dependency to the current project (implicit caret)`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await run(`config`, `set`, `defaultSemverRangePrefix`, `~`);
        await run(`add`, `no-deps`, `-C`);

        await expect(xfs.readJsonPromise(`${path}/package.json`)).resolves.toMatchObject({
          dependencies: {
            [`no-deps`]: `^2.0.0`,
          },
        });
      }),
    );

    test(
      `it should add a new regular dependency to the current project (tilde via defaultSemverRangePrefix)`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await run(`config`, `set`, `defaultSemverRangePrefix`, `~`);
        await run(`add`, `no-deps`);

        await expect(xfs.readJsonPromise(`${path}/package.json`)).resolves.toMatchObject({
          dependencies: {
            [`no-deps`]: `~2.0.0`,
          },
        });
      }),
    );

    test(
      `it should add a new regular dependency to the current project (exact via defaultSemverRangePrefix)`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await run(`config`, `set`, `defaultSemverRangePrefix`, ``);
        await run(`add`, `no-deps`);

        await expect(xfs.readJsonPromise(`${path}/package.json`)).resolves.toMatchObject({
          dependencies: {
            [`no-deps`]: `2.0.0`,
          },
        });
      }),
    );

    test(
      `it should add a new regular dependency to the current project (unnamed path)`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const packagePath = await getPackageDirectoryPath(`no-deps`, `1.0.0`);

        await run(`add`, packagePath);

        await expect(xfs.readJsonPromise(`${path}/package.json`)).resolves.toMatchObject({
          dependencies: {
            [`no-deps`]: packagePath,
          },
        });
      }),
    );

    test(
      `it should add a new development dependency to the current project`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await run(`add`, `no-deps`, `-D`);

        await expect(xfs.readJsonPromise(`${path}/package.json`)).resolves.toMatchObject({
          devDependencies: {
            [`no-deps`]: `^2.0.0`,
          },
        });
      }),
    );

    test(
      `it should upgrade the existing regular dependency in the current project (--prefer-dev)`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`add`, `no-deps`);

        await expect(xfs.readJsonPromise(`${path}/package.json`)).resolves.toMatchObject({
          dependencies: {
            [`no-deps`]: `^2.0.0`,
          },
        });
      }),
    );

    test(
      `it should upgrade the existing regular dependency in the current project (implicit)`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`add`, `no-deps`);

        await expect(xfs.readJsonPromise(`${path}/package.json`)).resolves.toMatchObject({
          dependencies: {
            [`no-deps`]: `^2.0.0`,
          },
        });
      }),
    );

    test(
      `it should upgrade the existing development dependency in the current project (-D)`,
      makeTemporaryEnv({
        devDependencies: {
          [`no-deps`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`add`, `no-deps`, `-D`);

        await expect(xfs.readJsonPromise(`${path}/package.json`)).resolves.toMatchObject({
          devDependencies: {
            [`no-deps`]: `^2.0.0`,
          },
        });
      }),
    );

    test(
      `it should upgrade the existing development dependency in the current project (--prefer-dev)`,
      makeTemporaryEnv({
        devDependencies: {
          [`no-deps`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`add`, `no-deps`);

        await expect(xfs.readJsonPromise(`${path}/package.json`)).resolves.toMatchObject({
          devDependencies: {
            [`no-deps`]: `^2.0.0`,
          },
        });
      }),
    );

    test(
      `it should upgrade the existing development dependency in the current project (implicit)`,
      makeTemporaryEnv({
        devDependencies: {
          [`no-deps`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`add`, `no-deps`);

        await expect(xfs.readJsonPromise(`${path}/package.json`)).resolves.toMatchObject({
          devDependencies: {
            [`no-deps`]: `^2.0.0`,
          },
        });
      }),
    );

    test(
      `it should add a new peer dependency to the current project`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await run(`add`, `no-deps`, `-P`);

        await expect(xfs.readJsonPromise(`${path}/package.json`)).resolves.toMatchObject({
          peerDependencies: {
            [`no-deps`]: `*`,
          },
        });
      }),
    );

    test(
      `it should throw an error when existing regular dependency is added using --dev`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await run(`add`, `no-deps`);
        await expect(
          run(`add`, `no-deps`, `-D`)
        ).rejects.toThrowError(/already listed as a regular dependency/);
      }),
    );

    test(
      `it should throw an error when existing regular dependency is added using --peer`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await run(`add`, `no-deps`);
        await expect(
          run(`add`, `no-deps`, `-P`)
        ).rejects.toThrowError(/already listed as a regular dependency/);
      }),
    );

    test(
      `it should throw an error when existing peer dependency is added without --peer|--dev`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await run(`add`, `no-deps`, `-P`);
        await expect(
          run(`add`, `no-deps`)
        ).rejects.toThrowError(/already listed as a peer dependency/);
      }),
    );

    test(
      `it should add an existing development dependency as peer dependency when added using --peer `,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await run(`add`, `no-deps`, `-D`);
        await run(`add`, `no-deps`, `-P`);

        await expect(xfs.readJsonPromise(`${path}/package.json`)).resolves.toMatchObject({
          devDependencies: {
            [`no-deps`]: `^2.0.0`,
          },
          peerDependencies: {
            [`no-deps`]: `*`,
          },
        });
      }),
    );

    test(
      `it should add a node-gyp dependency to the lockfile if a script uses it`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await run(`add`, `inject-node-gyp`);

        const content = await xfs.readFilePromise(`${path}/yarn.lock`, `utf8`);
        const lock = parseSyml(content);

        await expect(lock).toMatchObject({
          [`inject-node-gyp@npm:^1.0.0`]: {
            dependencies: {
              [`node-gyp`]: `latest`,
            },
          },
        });
      }),
    );

    test(
      `it should suggest a workspace if it would match the request`,
      makeTemporaryEnv({
        private: true,
        workspaces: [`packages/*`],
      }, async ({path, run, source}) => {
        await xfs.mkdirpPromise(`${path}/packages/no-deps`);

        await xfs.writeJsonPromise(`${path}/packages/no-deps/package.json`, {
          name: `no-deps`,
        });

        await run(`add`, `no-deps`);

        await expect(xfs.readJsonPromise(`${path}/package.json`)).resolves.toMatchObject({
          dependencies: {
            [`no-deps`]: `workspace:packages/no-deps`,
          },
        });
      })
    );

    test(
      `it shouldn't suggest a workspace to fulfill its own dependency`,
      makeTemporaryEnv({
        name: `no-deps`,
      }, async ({path, run, source}) => {
        await run(`add`, `no-deps`);

        await expect(xfs.readJsonPromise(`${path}/package.json`)).resolves.toMatchObject({
          dependencies: {
            [`no-deps`]: `^2.0.0`,
          },
        });
      })
    );

    test(`it should clean the cache when cache lives inside the project`, makeTemporaryEnv({
      dependencies: {
        [`no-deps`]: `1.0.0`,
      },
    }, async ({path, run, source}) => {
      await run(`install`);

      const preUpgradeCache = await xfs.readdirPromise(`${path}/.yarn/cache`);

      expect(preUpgradeCache.find(entry => entry.includes(`no-deps-npm-1.0.0`))).toBeDefined();

      const {code, stdout, stderr} = await run(`add`, `no-deps@2.0.0`);

      await expect({code, stdout, stderr}).toMatchSnapshot();

      const postUpgradeCache = await xfs.readdirPromise(`${path}/.yarn/cache`);

      expect(postUpgradeCache.find(entry => entry.includes(`no-deps-npm-1.0.0`))).toBeUndefined();
      expect(postUpgradeCache.find(entry => entry.includes(`no-deps-npm-2.0.0`))).toBeDefined();
    }));

    test(`it should not clean the cache when cache lives outside the project`, makeTemporaryEnv({
      dependencies: {
        [`no-deps`]: `1.0.0`,
      },
    }, async ({path, run, source}) => {
      const sharedCachePath = await xfs.mktempPromise();
      const env = {
        YARN_CACHE_FOLDER: sharedCachePath,
      };

      let cacheContent;

      await run(`install`, {env});

      cacheContent = await xfs.readdirPromise(sharedCachePath);

      expect(cacheContent.find(entry => entry.includes(`no-deps-npm-1.0.0`))).toBeDefined();

      await run(`add`, `no-deps@2.0.0`, {env});

      cacheContent = await xfs.readdirPromise(sharedCachePath);

      expect(cacheContent.find(entry => entry.includes(`no-deps-npm-1.0.0`))).toBeDefined();
      expect(cacheContent.find(entry => entry.includes(`no-deps-npm-2.0.0`))).toBeDefined();
    }));

    test(
      `it should show deprecation warnings for deprecated packages`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const {stdout} = await run(`add`, `no-deps-deprecated@1.0.0`);

        // Check if the deprecation warning is shown
        expect(stdout).toContain(`no-deps-deprecated@npm:1.0.0 is deprecated: ¯\\_(ツ)_/¯`);

        // Check if the package is installed successfully
        await expect(readManifest(path)).resolves.toMatchObject({
          dependencies: {
            [`no-deps-deprecated`]: `1.0.0`,
          },
        });
      }),
    );
  });
});
