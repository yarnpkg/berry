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

    describe(`with a specified version`, () => {
      test(
        `it should list workspaces using a specific version range`,
        makeTemporaryEnv({
          workspaces: [`packages/*`],
        }, async ({path, run, source}) => {
          await fs.writeJson(ppath.join(path, `packages/a/package.json`), {
            name: `a`,
            dependencies: {
              [`b`]: `workspace:^`,
              [`c`]: `workspace:^`,
              [`why-no-deps`]: `1.0.0`,
            },
          });

          await fs.writeJson(ppath.join(path, `packages/b/package.json`), {
            name: `b`,
            dependencies: {
              [`why-no-deps`]: `1.1.0`,
            },
          });

          await fs.writeJson(ppath.join(path, `packages/c/package.json`), {
            name: `c`,
            dependencies: {
              [`why-no-deps`]: `2.0.0`,
            },
          });

          await run(`install`);

          const {stdout} = await run(`why`, `why-no-deps@^1.1.0`, `--json`);

          // Don't list v1.0.0 (package A) nor v2.0.0 (package C)
          expect(misc.parseJsonStream(stdout)).toEqual([{
            value: `b@workspace:packages/b`,
            children: {
              [`why-no-deps@npm:1.1.0`]: {
                descriptor: `why-no-deps@npm:1.1.0`,
                locator: `why-no-deps@npm:1.1.0`,
              },
            },
          }]);
        }));

      test(
        `it should list workspaces transitively using a specific version range`,
        makeTemporaryEnv({
          workspaces: [`packages/*`],
        }, async ({path, run, source}) => {
          await fs.writeJson(ppath.join(path, `packages/a/package.json`), {
            name: `a`,
            dependencies: {
              [`b`]: `workspace:^`,
              [`why-range-dep`]: `1.0.0`,
            },
          });

          await fs.writeJson(ppath.join(path, `packages/b/package.json`), {
            name: `b`,
            dependencies: {
              [`c`]: `workspace:^`,
              [`why-range-dep`]: `1.1.0`,
            },
          });

          await fs.writeJson(ppath.join(path, `packages/c/package.json`), {
            name: `c`,
            dependencies: {
              [`d`]: `workspace:^`,
              [`why-range-dep`]: `1.1.1`,
            },
          });

          await fs.writeJson(ppath.join(path, `packages/d/package.json`), {
            name: `d`,
            dependencies: {
              [`why-range-dep`]: `2.0.0`,
            },
          });

          await run(`install`);

          const {stdout} = await run(`why`, `-R`, `why-no-deps@^1.1.0`, `--json`);

          // Don't list v1.0.0 (package A) nor v2.0.0 (package D)
          expect(stdout).not.toContain(`why-no-deps@npm:1.0.0`);
          expect(stdout).not.toContain(`why-no-deps@npm:1.0.1`);
          expect(stdout).not.toContain(`why-no-deps@npm:2.0.0`);

          expect(misc.parseJsonStream(stdout)).toEqual([{
            value: `a@workspace:packages/a`,
            children: {
              [`b@workspace:packages/b`]: {
                children: {},
                value: {
                  descriptor: `b@workspace:^`,
                  locator: `b@workspace:packages/b`,
                },
              },
              [`why-range-dep@npm:1.0.0`]: {
                value: {
                  descriptor: `why-range-dep@npm:1.0.0`,
                  locator: `why-range-dep@npm:1.0.0`,
                },
                children: {
                  [`why-no-deps@npm:1.1.1`]: {
                    children: {},
                    value: {
                      descriptor: `why-no-deps@npm:^1.0.0`,
                      locator: `why-no-deps@npm:1.1.1`,
                    },
                  },
                },
              },
            },
          }, {
            value: `b@workspace:packages/b`,
            children: {
              [`c@workspace:packages/c`]: {
                children: {},
                value: {
                  descriptor: `c@workspace:^`,
                  locator: `c@workspace:packages/c`,
                },
              },
              "why-range-dep@npm:1.1.0": {
                children: {
                  "why-no-deps@npm:1.1.1": {
                    children: {},
                    value: {
                      descriptor: `why-no-deps@npm:^1.1.0`,
                      locator: `why-no-deps@npm:1.1.1`,
                    },
                  },
                },
                value: {
                  descriptor: `why-range-dep@npm:1.1.0`,
                  locator: `why-range-dep@npm:1.1.0`,
                },
              },
            },
          }, {
            value: `c@workspace:packages/c`,
            children: {
              [`why-range-dep@npm:1.1.1`]: {
                value: {
                  descriptor: `why-range-dep@npm:1.1.1`,
                  locator: `why-range-dep@npm:1.1.1`,
                },
                children: {
                  [`why-no-deps@npm:1.1.1`]: {
                    children: {},
                    value: {
                      descriptor: `why-no-deps@npm:^1.1.1`,
                      locator: `why-no-deps@npm:1.1.1`,
                    },
                  },
                },
              },
            },
          }]);
        }));

      test(
        `it should not list the packages with an out-of-range range specified`,
        makeTemporaryEnv({
          workspaces: [`packages/*`],
        }, async ({path, run, source}) => {
          await fs.writeJson(ppath.join(path, `package.json`), {
            name: `a`,
            dependencies: {
              [`why-no-deps`]: `1.0.0`,
            },
          });
          await run(`install`);

          const {stdout} = await run(`why`, `why-no-deps@2.0.0`, `--json`);
          return expect(stdout).toEqual(``);
        }));

      test(`it should fail with non-semver range specified`, makeTemporaryEnv({
        workspaces: [`packages/*`],
      }, async ({path, run, source}) => {
        await run(`install`);
        await expect(run(`why`, `why-no-deps@1.0.0`)).resolves.not.toThrow();
        await expect(run(`why`, `irrelevant-dependency@invalid.range`)).rejects.toThrow();
      }));
    });
  });
});
