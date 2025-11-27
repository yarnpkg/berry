import {PortablePath, npath, xfs}           from '@yarnpkg/fslib';
import {stringifySyml}                      from '@yarnpkg/parsers';

describe(`Features`, () => {
  describe(`Before Hooks`, () => {
    describe(`beforeWorkspaceDependencyAddition`, () => {
      test(
        `it should allow plugins to modify descriptor before addition`,
        makeTemporaryEnv({}, async ({path, run}) => {
          const pluginPath = npath.toPortablePath(require.resolve(`@yarnpkg/monorepo/scripts/plugin-before-hooks-test.js`));
          const pluginContent = await xfs.readFilePromise(pluginPath);
          await xfs.writeFilePromise(`${path}/plugin-before-hooks.js` as PortablePath, pluginContent);

          await xfs.writeFilePromise(`${path}/.yarnrc.yml` as PortablePath, stringifySyml({
            plugins: [`./plugin-before-hooks.js`],
          }));

          await run(`add`, `no-deps`);

          await expect(xfs.readJsonPromise(`${path}/package.json` as PortablePath)).resolves.toMatchObject({
            dependencies: {
              [`no-deps`]: `^1.0.0`,
            },
          });
        }),
      );

      test(
        `it should work with dev dependencies`,
        makeTemporaryEnv({}, async ({path, run}) => {
          const pluginPath = npath.toPortablePath(require.resolve(`@yarnpkg/monorepo/scripts/plugin-before-hooks-test.js`));
          const pluginContent = await xfs.readFilePromise(pluginPath);
          await xfs.writeFilePromise(`${path}/plugin-before-hooks.js` as PortablePath, pluginContent);

          await xfs.writeFilePromise(`${path}/.yarnrc.yml` as PortablePath, stringifySyml({
            plugins: [`./plugin-before-hooks.js`],
          }));

          await run(`add`, `no-deps`, `-D`);

          await expect(xfs.readJsonPromise(`${path}/package.json` as PortablePath)).resolves.toMatchObject({
            devDependencies: {
              [`no-deps`]: `^1.0.0`,
            },
          });
        }),
      );

      test(
        `it should not affect other packages`,
        makeTemporaryEnv({}, async ({path, run}) => {
          const pluginPath = npath.toPortablePath(require.resolve(`@yarnpkg/monorepo/scripts/plugin-before-hooks-test.js`));
          const pluginContent = await xfs.readFilePromise(pluginPath);
          await xfs.writeFilePromise(`${path}/plugin-before-hooks.js` as PortablePath, pluginContent);

          await xfs.writeFilePromise(`${path}/.yarnrc.yml` as PortablePath, stringifySyml({
            plugins: [`./plugin-before-hooks.js`],
          }));

          await run(`add`, `one-fixed-dep`);

          await expect(xfs.readJsonPromise(`${path}/package.json` as PortablePath)).resolves.toMatchObject({
            dependencies: {
              [`one-fixed-dep`]: `^2.0.0`, 
            },
          });
        }),
      );
    });

    describe(`beforeWorkspaceDependencyReplacement`, () => {
      test(
        `it should allow plugins to modify descriptor before replacement via yarn add`,
        makeTemporaryEnv(
          {
            dependencies: {
              'no-deps': `^1.0.0`,
            },
          },
          async ({path, run}) => {
            const pluginPath = npath.toPortablePath(require.resolve(`@yarnpkg/monorepo/scripts/plugin-before-hooks-test.js`));
            const pluginContent = await xfs.readFilePromise(pluginPath);
            await xfs.writeFilePromise(`${path}/plugin-before-hooks.js` as PortablePath, pluginContent);

            await xfs.writeFilePromise(`${path}/.yarnrc.yml` as PortablePath, stringifySyml({
              plugins: [`./plugin-before-hooks.js`],
            }));

            await run(`add`, `no-deps@^1.5.0`);

            await expect(xfs.readJsonPromise(`${path}/package.json` as PortablePath)).resolves.toMatchObject({
              dependencies: {
                [`no-deps`]: `^2.0.0`,
              },
            });
          },
        ),
      );

      test(
        `it should allow plugins to modify descriptor before replacement via yarn up`,
        makeTemporaryEnv(
          {
            dependencies: {
              'no-deps': `^1.0.0`,
            },
          },
          async ({path, run}) => {
            const pluginPath = npath.toPortablePath(require.resolve(`@yarnpkg/monorepo/scripts/plugin-before-hooks-test.js`));
            const pluginContent = await xfs.readFilePromise(pluginPath);
            await xfs.writeFilePromise(`${path}/plugin-before-hooks.js` as PortablePath, pluginContent);

            await xfs.writeFilePromise(`${path}/.yarnrc.yml` as PortablePath, stringifySyml({
              plugins: [`./plugin-before-hooks.js`],
            }));

            await run(`up`, `no-deps`);

            await expect(xfs.readJsonPromise(`${path}/package.json` as PortablePath)).resolves.toMatchObject({
              dependencies: {
                [`no-deps`]: `^2.0.0`,
              },
            });
          },
        ),
      );
    });

    describe(`beforeWorkspaceDependencyRemoval`, () => {
      test(
        `it should allow plugins to block removal by throwing`,
        makeTemporaryEnv(
          {
            dependencies: {
              'no-deps': `^2.0.0`,
            },
          },
          async ({path, run}) => {
            const pluginPath = npath.toPortablePath(require.resolve(`@yarnpkg/monorepo/scripts/plugin-before-hooks-test.js`));
            const pluginContent = await xfs.readFilePromise(pluginPath);
            await xfs.writeFilePromise(`${path}/plugin-before-hooks.js` as PortablePath, pluginContent);

            await xfs.writeFilePromise(`${path}/.yarnrc.yml` as PortablePath, stringifySyml({
              plugins: [`./plugin-before-hooks.js`],
            }));

            await expect(run(`remove`, `no-deps`)).rejects.toThrow();

            await expect(xfs.readJsonPromise(`${path}/package.json` as PortablePath)).resolves.toMatchObject({
              dependencies: {
                'no-deps': `^2.0.0`,
              },
            });
          },
        ),
      );

      test(
        `it should allow removal of other packages`,
        makeTemporaryEnv(
          {
            dependencies: {
              'one-fixed-dep': `^1.0.0`,
            },
          },
          async ({path, run}) => {
            const pluginPath = npath.toPortablePath(require.resolve(`@yarnpkg/monorepo/scripts/plugin-before-hooks-test.js`));
            const pluginContent = await xfs.readFilePromise(pluginPath);
            await xfs.writeFilePromise(`${path}/plugin-before-hooks.js` as PortablePath, pluginContent);

            await xfs.writeFilePromise(`${path}/.yarnrc.yml` as PortablePath, stringifySyml({
              plugins: [`./plugin-before-hooks.js`],
            }));

            await run(`remove`, `one-fixed-dep`);

            const manifest = await xfs.readJsonPromise(`${path}/package.json` as PortablePath);
            expect(manifest.dependencies).toBeUndefined();
          },
        ),
      );
    });

    describe(`Multiple hooks interaction`, () => {
      test(
        `it should handle both addition and replacement hooks in yarn add`,
        makeTemporaryEnv(
          {
            dependencies: {
              'no-deps': `^1.0.0`,
            },
          },
          async ({path, run}) => {
            const pluginPath = npath.toPortablePath(require.resolve(`@yarnpkg/monorepo/scripts/plugin-before-hooks-test.js`));
            const pluginContent = await xfs.readFilePromise(pluginPath);
            await xfs.writeFilePromise(`${path}/plugin-before-hooks.js` as PortablePath, pluginContent);

            await xfs.writeFilePromise(`${path}/.yarnrc.yml` as PortablePath, stringifySyml({
              plugins: [`./plugin-before-hooks.js`],
            }));

            await run(`add`, `no-deps@^1.5.0`);

            await expect(xfs.readJsonPromise(`${path}/package.json` as PortablePath)).resolves.toMatchObject({
              dependencies: {
                [`no-deps`]: `^2.0.0`,
              },
            });

            await run(`add`, `one-fixed-dep`);

            await expect(xfs.readJsonPromise(`${path}/package.json` as PortablePath)).resolves.toMatchObject({
              dependencies: {
                [`no-deps`]: `^2.0.0`,
                [`one-fixed-dep`]: expect.any(String),
              },
            });
          },
        ),
      );
    });
  });
});
