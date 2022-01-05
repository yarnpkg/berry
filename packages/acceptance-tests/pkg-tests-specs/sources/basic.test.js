const {xfs} = require(`@yarnpkg/fslib`);
const {
  tests: {getPackageArchivePath, getPackageHttpArchivePath, getPackageDirectoryPath},
} = require(`pkg-tests-core`);

const configs = [{
  nodeLinker: `pnp`,
}, {
  nodeLinker: `pnpm`,
}, {
  nodeLinker: `node-modules`,
}];

describe(`Basic tests`, () => {
  for (const config of configs) {
    describe(`w/ the ${config.nodeLinker} linker`, () => {
      test(
        `it should correctly handle browser fields in package.json`,
        makeTemporaryEnv(
          {
            dependencies: {[`no-deps-browser-field`]: `1.0.0`},
          },
          config,
          async ({path, run, source}) => {
            await run(`install`);
            await expect(source(`require('no-deps-browser-field')`)).resolves.toMatchObject({
              './index.js': `./index.js`,
            });
          },
        ),
      );

      test(
        `it should correctly install a single dependency that contains no sub-dependencies`,
        makeTemporaryEnv(
          {
            dependencies: {[`no-deps`]: `1.0.0`},
          },
          config,
          async ({path, run, source}) => {
            await run(`install`);

            await expect(source(`require('no-deps')`)).resolves.toMatchObject({
              name: `no-deps`,
              version: `1.0.0`,
            });
          },
        ),
      );

      test(
        `it should correctly install a single scoped dependency that contains no sub-dependencies`,
        makeTemporaryEnv(
          {
            dependencies: {[`@types/no-deps`]: `1.0.0`},
          },
          config,
          async ({path, run, source}) => {
            await run(`install`);

            await expect(source(`require('@types/no-deps')`)).resolves.toMatchObject({
              name: `@types/no-deps`,
              version: `1.0.0`,
            });
          },
        ),
      );

      test(
        `it should correctly install a single aliased dependency that contains no sub-dependencies`,
        makeTemporaryEnv(
          {
            dependencies: {[`aliased`]: `npm:no-deps@1.0.0`},
          },
          config,
          async ({path, run, source}) => {
            await run(`install`);

            await expect(source(`require('aliased')`)).resolves.toMatchObject({
              name: `no-deps`,
              version: `1.0.0`,
            });
          },
        ),
      );

      test(
        `it should correctly install a dependency that itself contains a fixed dependency`,
        makeTemporaryEnv(
          {
            dependencies: {[`one-fixed-dep`]: `1.0.0`},
          },
          config,
          async ({path, run, source}) => {
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
          },
        ),
      );

      test(
        `it should correctly install a dependency that itself contains a range dependency`,
        makeTemporaryEnv(
          {
            dependencies: {[`one-range-dep`]: `1.0.0`},
          },
          config,
          async ({path, run, source}) => {
            await run(`install`);

            await expect(source(`require('one-range-dep')`)).resolves.toMatchObject({
              name: `one-range-dep`,
              version: `1.0.0`,
              dependencies: {
                [`no-deps`]: {
                  name: `no-deps`,
                  version: `1.1.0`,
                },
              },
            });
          },
        ),
      );

      test(
        `it should correctly install an inter-dependency loop`,
        makeTemporaryEnv(
          {
            dependencies: {[`dep-loop-entry`]: `1.0.0`},
          },
          config,
          async ({path, run, source}) => {
            await run(`install`);

            await expect(
              source(
                // eslint-disable-next-line
                `require('dep-loop-entry') === require('dep-loop-entry').dependencies['dep-loop-exit'].dependencies['dep-loop-entry']`,
              ),
            );
          },
        ),
      );

      test(
        `it should install from archives on the filesystem`,
        makeTemporaryEnv(
          {
            dependencies: {[`no-deps`]: getPackageArchivePath(`no-deps`, `1.0.0`)},
          },
          config,
          async ({path, run, source}) => {
            await run(`install`);

            await expect(source(`require('no-deps')`)).resolves.toMatchObject({
              name: `no-deps`,
              version: `1.0.0`,
            });
          },
        ),
      );

      test(
        `it should install the dependencies of any dependency fetched from the filesystem`,
        makeTemporaryEnv(
          {
            dependencies: {[`one-fixed-dep`]: getPackageArchivePath(`one-fixed-dep`, `1.0.0`)},
          },
          config,
          async ({path, run, source}) => {
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
          },
        ),
      );

      test(
        `it should install from files on the internet`,
        makeTemporaryEnv(
          {
            dependencies: {[`no-deps`]: getPackageHttpArchivePath(`no-deps`, `1.0.0`)},
          },
          config,
          async ({path, run, source}) => {
            await run(`install`);

            await expect(source(`require('no-deps')`)).resolves.toMatchObject({
              name: `no-deps`,
              version: `1.0.0`,
            });
          },
        ),
      );

      test(
        `it should install the dependencies of any dependency fetched from the internet`,
        makeTemporaryEnv(
          {
            dependencies: {[`one-fixed-dep`]: getPackageHttpArchivePath(`one-fixed-dep`, `1.0.0`)},
          },
          config,
          async ({path, run, source}) => {
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
          },
        ),
      );

      test(
        `it should install from local directories`,
        makeTemporaryEnv(
          {
            dependencies: {[`no-deps`]: getPackageDirectoryPath(`no-deps`, `1.0.0`)},
          },
          config,
          async ({path, run, source}) => {
            await run(`install`);

            await expect(source(`require('no-deps')`)).resolves.toMatchObject({
              name: `no-deps`,
              version: `1.0.0`,
            });
          },
        ),
      );

      test(
        `it should install the dependencies of any dependency fetched from a local directory`,
        makeTemporaryEnv(
          {
            dependencies: {[`one-fixed-dep`]: getPackageDirectoryPath(`one-fixed-dep`, `1.0.0`)},
          },
          config,
          async ({path, run, source}) => {
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
          },
        ),
      );

      test(
        `it should correctly create resolution mounting points when using the link protocol`,
        makeTemporaryEnv(
          {
            dependencies: {[`link-dep`]: (async () => `link:${await getPackageDirectoryPath(`no-deps`, `1.0.0`)}`)()},
          },
          config,
          async ({path, run, source}) => {
            await run(`install`);

            await expect(source(`require('link-dep')`)).resolves.toMatchObject({
              name: `no-deps`,
              version: `1.0.0`,
            });
          },
        ),
      );

      test(
        `it should install in such a way that peer dependencies can be resolved (from top-level)`,
        makeTemporaryEnv(
          {
            dependencies: {[`peer-deps`]: `1.0.0`, [`no-deps`]: `1.0.0`},
          },
          config,
          async ({path, run, source}) => {
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
          },
        ),
      );

      test(
        `it should install in such a way that peer dependencies can be resolved (from within a dependency)`,
        makeTemporaryEnv(
          {
            dependencies: {[`provides-peer-deps-1-0-0`]: `1.0.0`},
          },
          config,
          async ({path, run, source}) => {
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
                [`no-deps`]: {
                  name: `no-deps`,
                  version: `1.0.0`,
                },
              },
            });
          },
        ),
      );

      test(
        `it should install in such a way that peer dependencies can be resolved (two levels deep)`,
        makeTemporaryEnv(
          {
            dependencies: {[`peer-deps-lvl0`]: `1.0.0`},
          },
          config,
          async ({path, run, source}) => {
            await run(`install`);

            await expect(source(`require('peer-deps-lvl0')`)).resolves.toMatchObject({
              name: `peer-deps-lvl0`,
              version: `1.0.0`,
              dependencies: {
                [`peer-deps-lvl1`]: {
                  name: `peer-deps-lvl1`,
                  version: `1.0.0`,
                  dependencies: {
                    [`peer-deps-lvl2`]: {
                      name: `peer-deps-lvl2`,
                      version: `1.0.0`,
                      peerDependencies: {
                        [`no-deps`]: {
                          name: `no-deps`,
                          version: `1.0.0`,
                        },
                      },
                    },
                  },
                  peerDependencies: {
                    [`no-deps`]: {
                      name: `no-deps`,
                      version: `1.0.0`,
                    },
                  },
                },
                [`no-deps`]: {
                  name: `no-deps`,
                  version: `1.0.0`,
                },
              },
            });
          },
        ),
      );

      test(
        `it should prefer peer dependencies when a package also has the same regular dependency`,
        makeTemporaryEnv(
          {
            dependencies: {
              [`fallback-peer-deps`]: `1.0.0`,
              [`no-deps`]: `1.0.0`,
            },
          },
          config,
          async ({path, run, source}) => {
            await run(`install`);

            await expect(source(`require('fallback-peer-deps')`)).resolves.toMatchObject({
              name: `fallback-peer-deps`,
              version: `1.0.0`,
              dependencies: {
                [`no-deps`]: {
                  name: `no-deps`,
                  version: `1.0.0`,
                },
              },
            });
          },
        ),
      );

      test(
        `it should fallback to the regular dependency if the peer dependency isn't met`,
        makeTemporaryEnv(
          {
            dependencies: {
              [`fallback-peer-deps`]: `1.0.0`,
            },
          },
          config,
          async ({path, run, source}) => {
            await run(`install`);

            await expect(source(`require('fallback-peer-deps')`)).resolves.toMatchObject({
              name: `fallback-peer-deps`,
              version: `1.0.0`,
              dependencies: {
                [`no-deps`]: {
                  name: `no-deps`,
                  version: `2.0.0`,
                },
              },
            });
          },
        ),
      );

      test(
        `it should allow accessing a package via too many slashes`,
        makeTemporaryEnv(
          {
            dependencies: {[`various-requires`]: `1.0.0`},
          },
          config,
          async ({path, run, source}) => {
            await run(`install`);

            await expect(source(`require('various-requires//self')`)).resolves.toMatchObject({
              name: `various-requires`,
              version: `1.0.0`,
            });
          },
        ),
      );

      test(
        `it should fallback to dependencies if the parent doesn't provide the peer dependency`,
        makeTemporaryEnv(
          {},
          config,
          async ({path, run, source}) => {
            await xfs.mkdirPromise(`${path}/lib`);

            await xfs.writeFilePromise(`${path}/lib/index.js`, `
              module.exports = require('fallback-peer-deps');
            `);

            await xfs.writeJsonPromise(`${path}/lib/package.json`, {
              dependencies: {
                [`fallback-peer-deps`]: `1.0.0`,
              },
              peerDependencies: {
                [`no-deps`]: `*`,
              },
            });

            await xfs.writeJsonPromise(`${path}/package.json`, {
              dependencies: {
                [`lib`]: `file:${path}/lib`,
              },
            });

            await run(`install`);

            await expect(source(`require('lib')`)).resolves.toMatchObject({
              name: `fallback-peer-deps`,
              version: `1.0.0`,
              dependencies: {
                [`no-deps`]: {
                  name: `no-deps`,
                  version: `2.0.0`,
                },
              },
            });
          },
        ),
      );

      test(
        `it should support self-requires in direct dependencies`,
        makeTemporaryEnv(
          {
            dependencies: {[`various-requires`]: `1.0.0`},
          },
          config,
          async ({path, run, source}) => {
            await run(`install`);

            await expect(source(`require('various-requires/self')`)).resolves.toMatchObject({
              name: `various-requires`,
              version: `1.0.0`,
            });
          },
        ),
      );

      test(
        `it should support self-requires in transitive dependencies`,
        makeTemporaryEnv(
          {
            dependencies: {[`self-require-dep`]: `1.0.0`},
          },
          config,
          async ({path, run, source}) => {
            await run(`install`);

            await expect(source(`require('self-require-dep/self')`)).resolves.toMatchObject({
              name: `various-requires`,
              version: `1.0.0`,
            });
          },
        ),
      );

      test(
        `it should not add the implicit self dependency if an explicit one already exists`,
        makeTemporaryEnv(
          {
            dependencies: {[`self-require-trap`]: `1.0.0`},
          },
          config,
          async ({path, run, source}) => {
            // We run 2 installs because while refactoring the pnpm linker, running a second install highlighted a symlink issue
            for (let i = 0; i < 2; i++) {
              await run(`install`);

              await expect(source(`require('self-require-trap')`)).resolves.toMatchObject({
                name: `self-require-trap`,
                version: `1.0.0`,
              });

              await expect(source(`require('self-require-trap/self')`)).resolves.toMatchObject({
                name: `self-require-trap`,
                version: `2.0.0`,
              });
            }
          },
        ),
      );

      test(
        `it should not add the implicit self dependency if an explicit one already exists (aliases)`,
        makeTemporaryEnv(
          {
            dependencies: {[`aliased`]: `npm:self-require-trap@1.0.0`},
          },
          config,
          async ({path, run, source}) => {
            // We run 2 installs because while refactoring the pnpm linker, running a second install highlighted a symlink issue
            for (let i = 0; i < 2; i++) {
              await run(`install`);

              await expect(source(`require('aliased')`)).resolves.toMatchObject({
                name: `self-require-trap`,
                version: `1.0.0`,
              });

              await expect(source(`require('aliased/self')`)).resolves.toMatchObject({
                name: `self-require-trap`,
                version: `2.0.0`,
              });
            }
          },
        ),
      );

      test(
        `it should correctly install a soft-link`,
        makeTemporaryEnv(
          {
            dependencies: {[`soft-link`]: `portal:./soft-link`},
          },
          config,
          async ({path, run, source}) => {
            await xfs.mkdirPromise(`${path}/soft-link`);
            await xfs.writeJsonPromise(`${path}/soft-link/package.json`, {
              name: `soft-link`,
              version: `1.0.0`,
            });
            await xfs.writeFilePromise(`${path}/soft-link/index.js`, `module.exports = require('./package.json');\n`);

            await run(`install`);

            await expect(source(`require('soft-link')`)).resolves.toMatchObject({
              name: `soft-link`,
              version: `1.0.0`,
            });
          },
        ),
      );
    });
  }
});
