const {xfs} = require(`@yarnpkg/fslib`);
const {
  fs: {readJson, writeJson},
  tests: {getPackageDirectoryPath},
} = require(`pkg-tests-core`);

describe(`Protocols`, () => {
  describe(`portal:`, () => {
    test(
      `it should link a remote project into the current dependency tree`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps`]: getPackageDirectoryPath(`no-deps`, `1.0.0`).then(dirPath => `portal:${dirPath}`),
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        await expect(source(`require('no-deps/package.json')`)).resolves.toMatchObject({
          name: `no-deps`,
          version: `1.0.0`,
        });
      }),
    );

    test(
      `it should take into account portals' own dependencies`,
      makeTemporaryEnv({
        dependencies: {
          [`one-fixed-dep`]: getPackageDirectoryPath(`one-fixed-dep`, `1.0.0`).then(dirPath => `portal:${dirPath}`),
        },
      }, async ({path, run, source}) => {
        await run(`install`);

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
      `it should allow portals to access their peer dependencies (single occurence)`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps`]: `1.0.0`,
          [`peer-deps`]: getPackageDirectoryPath(`peer-deps`, `1.0.0`).then(dirPath => `portal:${dirPath}`),
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        await expect(source(`require('peer-deps')`)).resolves.toMatchObject({
          name: `peer-deps`,
          version: `1.0.0`,
          peerDependencies: {
            [`no-deps`]: {
              name: `no-deps`,
              version: `1.0.0`,
            },
          },
        });
      }),
    );

    test(
      `it should allow portals to access their peer dependencies (multiple occurences)`,
      makeTemporaryEnv({
        dependencies: {
          [`provides-peer-deps-1-0-0`]: `file:./provides-peer-deps-1-0-0`,
          [`provides-peer-deps-2-0-0`]: `file:./provides-peer-deps-2-0-0`,
        },
      }, async ({path, run, source}) => {
        await xfs.copyPromise(`${path}/provides-peer-deps-1-0-0`, await getPackageDirectoryPath(`provides-peer-deps-1-0-0`, `1.0.0`));
        await xfs.copyPromise(`${path}/provides-peer-deps-2-0-0`, await getPackageDirectoryPath(`provides-peer-deps-2-0-0`, `1.0.0`));

        const providesPeerDeps100 = await readJson(`${path}/provides-peer-deps-1-0-0/package.json`);
        providesPeerDeps100.dependencies[`peer-deps`] = `portal:${await getPackageDirectoryPath(`peer-deps`, `1.0.0`)}`;
        await writeJson(`${path}/provides-peer-deps-1-0-0/package.json`, providesPeerDeps100);

        const providesPeerDeps200 = await readJson(`${path}/provides-peer-deps-2-0-0/package.json`);
        providesPeerDeps200.dependencies[`peer-deps`] = `portal:${await getPackageDirectoryPath(`peer-deps`, `1.0.0`)}`;
        await writeJson(`${path}/provides-peer-deps-2-0-0/package.json`, providesPeerDeps200);

        await run(`install`);

        await expect(source(`require('provides-peer-deps-1-0-0')`)).resolves.toMatchObject({
          name: `provides-peer-deps-1-0-0`,
          version: `1.0.0`,
          dependencies: {
            [`peer-deps`]: {
              name: `peer-deps`,
              version: `1.0.0`,
              peerDependencies: {
                [`no-deps`]: {
                  name: `no-deps`,
                  version: `1.0.0`,
                },
              },
            },
          },
        });

        await expect(source(`require('provides-peer-deps-2-0-0')`)).resolves.toMatchObject({
          name: `provides-peer-deps-2-0-0`,
          version: `1.0.0`,
          dependencies: {
            [`peer-deps`]: {
              name: `peer-deps`,
              version: `1.0.0`,
              peerDependencies: {
                [`no-deps`]: {
                  name: `no-deps`,
                  version: `2.0.0`,
                },
              },
            },
          },
        });
      }),
    );
  });
});
