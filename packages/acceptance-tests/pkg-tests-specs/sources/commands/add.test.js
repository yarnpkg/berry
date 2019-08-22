const {readdir} = require(`fs-extra`);
const {
  fs: {createTemporaryFolder, readJson, readFile},
  tests: {getPackageDirectoryPath},
} = require('pkg-tests-core');
const {parseSyml} = require('@berry/parsers');

describe(`Commands`, () => {
  describe(`add`, () => {
    test(
      `it should add a new regular dependency to the current project (explicit semver)`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await run(`add`, `no-deps@1.0.0`);

        await expect(readJson(`${path}/package.json`)).resolves.toMatchObject({
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

        await expect(readJson(`${path}/package.json`)).resolves.toMatchObject({
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

        await expect(readJson(`${path}/package.json`)).resolves.toMatchObject({
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

        await expect(readJson(`${path}/package.json`)).resolves.toMatchObject({
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

        await expect(readJson(`${path}/package.json`)).resolves.toMatchObject({
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

        await expect(readJson(`${path}/package.json`)).resolves.toMatchObject({
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

        await expect(readJson(`${path}/package.json`)).resolves.toMatchObject({
          peerDependencies: {
            [`no-deps`]: `*`,
          },
        });
      }),
    );

    test(
      `it should add node-gyp dependency to yarn.lock if a script uses it`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await run(`add`, `inject-node-gyp`);

        const content = await readFile(`${path}/yarn.lock`, `utf8`);
        const lock = parseSyml(content);

        await expect(lock).toMatchObject({
          [`inject-node-gyp@npm:^1.0.0`]: {
            dependencies: {
              "node-gyp": "npm:*"
            }
          }
        });
      }),
    );

    test(`it should clean the cache when cache lives inside the project`, makeTemporaryEnv({
      dependencies: {
        [`no-deps`]: `1.0.0`,
      },
    }, async ({path, run, source}) => {
      let code;
      let stdout;
      let stderr;

      await run(`install`);

      const preUpgradeCache = await readdir(`${path}/.yarn/cache`);

      expect(preUpgradeCache.find(entry => entry.includes('no-deps-npm-1.0.0'))).toBeDefined();

      ({ code, stdout, stderr } = await run(`add`, `no-deps@2.0.0`));

      await expect({code, stdout, stderr}).toMatchSnapshot();

      const postUpgradeCache = await readdir(`${path}/.yarn/cache`);

      expect(postUpgradeCache.find(entry => entry.includes('no-deps-npm-1.0.0'))).toBeUndefined();
      expect(postUpgradeCache.find(entry => entry.includes('no-deps-npm-2.0.0'))).toBeDefined();
    }));

    test(`it should not clean the cache when cache lives outside the project`, makeTemporaryEnv({
      dependencies: {
        [`no-deps`]: `1.0.0`,
      },
    }, async ({path, run, source}) => {
      const sharedCachePath = await createTemporaryFolder();
      const env = {
        YARN_CACHE_FOLDER: sharedCachePath
      };

      let cacheContent;

      await run(`install`, {env});

      cacheContent = await readdir(sharedCachePath);

      expect(cacheContent.find(entry => entry.includes('no-deps-npm-1.0.0'))).toBeDefined();

      await run(`add`, `no-deps@2.0.0`, {env});

      cacheContent = await readdir(sharedCachePath);

      expect(cacheContent.find(entry => entry.includes('no-deps-npm-1.0.0'))).toBeDefined();
      expect(cacheContent.find(entry => entry.includes('no-deps-npm-2.0.0'))).toBeDefined();
    }));
  });
});
