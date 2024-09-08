import {ppath}    from '@yarnpkg/fslib';
import {fs, misc} from 'pkg-tests-core';

describe(`Commands`, () => {
  describe(`why`, () => {
    test(
      `it should list the workspaces using a specific dependency`,
      makeTemporaryEnv({
        workspaces: [`packages/*`],
      }, async ({path, run, source}) => {
        await fs.writeJson(ppath.join(path, `packages/a/package.json`), {
          name: `a`,
          dependencies: {
            [`no-deps`]: `1.0.0`,
          },
        });

        await fs.writeJson(ppath.join(path, `packages/b/package.json`), {
          name: `b`,
        });

        await run(`install`);

        const {stdout} = await run(`why`, `no-deps`, `--json`);

        expect(misc.parseJsonStream(stdout)).toEqual([{
          value: `a@workspace:packages/a`,
          children: {
            [`no-deps@npm:1.0.0`]: {
              descriptor: `no-deps@npm:1.0.0`,
              locator: `no-deps@npm:1.0.0`,
            },
          },
        }]);
      }),
    );

    test(
      `it should list the packages using a specific dependency`,
      makeTemporaryEnv({
        workspaces: [`packages/*`],
      }, async ({path, run, source}) => {
        await fs.writeJson(ppath.join(path, `packages/a/package.json`), {
          name: `a`,
          dependencies: {
            [`one-fixed-dep`]: `1.0.0`,
          },
        });

        await fs.writeJson(ppath.join(path, `packages/b/package.json`), {
          name: `b`,
        });

        await run(`install`);

        const {stdout} = await run(`why`, `no-deps`, `--json`);

        expect(misc.parseJsonStream(stdout)).toEqual([{
          value: `one-fixed-dep@npm:1.0.0`,
          children: {
            [`no-deps@npm:1.0.0`]: {
              descriptor: `no-deps@npm:1.0.0`,
              locator: `no-deps@npm:1.0.0`,
            },
          },
        }]);
      }),
    );

    test(
      `it should list workspaces transitively using a specific dependency`,
      makeTemporaryEnv({
        workspaces: [`packages/*`],
      }, async ({path, run, source}) => {
        await fs.writeJson(ppath.join(path, `packages/a/package.json`), {
          name: `a`,
          dependencies: {
            [`one-fixed-dep`]: `1.0.0`,
          },
        });

        await fs.writeJson(ppath.join(path, `packages/b/package.json`), {
          name: `b`,
        });

        await run(`install`);

        const {stdout} = await run(`why`, `-R`, `no-deps`, `--json`);

        expect(misc.parseJsonStream(stdout)).toEqual([{
          value: `a@workspace:packages/a`,
          children: {
            [`one-fixed-dep@npm:1.0.0`]: {
              value: {
                descriptor: `one-fixed-dep@npm:1.0.0`,
                locator: `one-fixed-dep@npm:1.0.0`,
              },
              children: {
                [`no-deps@npm:1.0.0`]: {
                  value: {
                    descriptor: `no-deps@npm:1.0.0`,
                    locator: `no-deps@npm:1.0.0`,
                  },
                  children: {},
                },
              },
            },
          },
        }]);
      }),
    );

    test(
      `it should list workspaces transitively using a specific dependency (A = regular dep, B = workspace dep)`,
      makeTemporaryEnv({
        workspaces: [`packages/*`],
      }, async ({path, run, source}) => {
        await fs.writeJson(ppath.join(path, `packages/a/package.json`), {
          name: `a`,
          dependencies: {
            [`no-deps`]: `1.0.0`,
          },
        });

        await fs.writeJson(ppath.join(path, `packages/b/package.json`), {
          name: `b`,
          dependencies: {
            [`a`]: `workspace:^`,
          },
        });

        await run(`install`);

        const {stdout} = await run(`why`, `-R`, `no-deps`, `--json`);

        expect(misc.parseJsonStream(stdout)).toEqual([{
          value: `a@workspace:packages/a`,
          children: {
            [`no-deps@npm:1.0.0`]: {
              value: {
                descriptor: `no-deps@npm:1.0.0`,
                locator: `no-deps@npm:1.0.0`,
              },
              children: {},
            },
          },
        }, {
          value: `b@workspace:packages/b`,
          children: {
            [`a@workspace:packages/a`]: {
              value: {
                descriptor: `a@workspace:^`,
                locator: `a@workspace:packages/a`,
              },
              children: {},
            },
          },
        }]);
      }),
    );

    test(
      `it should list workspaces transitively using a specific dependency (A = workspace dep, B = regular dep)`,
      makeTemporaryEnv({
        workspaces: [`packages/*`],
      }, async ({path, run, source}) => {
        await fs.writeJson(ppath.join(path, `packages/a/package.json`), {
          name: `a`,
          dependencies: {
            [`b`]: `workspace:^`,
          },
        });

        await fs.writeJson(ppath.join(path, `packages/b/package.json`), {
          name: `b`,
          dependencies: {
            [`no-deps`]: `1.0.0`,
          },
        });

        await run(`install`);

        const {stdout} = await run(`why`, `-R`, `no-deps`, `--json`);

        expect(misc.parseJsonStream(stdout)).toEqual([{
          value: `a@workspace:packages/a`,
          children: {
            [`b@workspace:packages/b`]: {
              value: {
                descriptor: `b@workspace:^`,
                locator: `b@workspace:packages/b`,
              },
              children: {},
            },
          },
        }, {
          value: `b@workspace:packages/b`,
          children: {
            [`no-deps@npm:1.0.0`]: {
              value: {
                descriptor: `no-deps@npm:1.0.0`,
                locator: `no-deps@npm:1.0.0`,
              },
              children: {},
            },
          },
        }]);
      }),
    );
  });
});
