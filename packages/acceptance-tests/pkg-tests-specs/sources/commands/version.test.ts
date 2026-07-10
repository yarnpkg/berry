import {xfs, ppath, PortablePath, Filename} from '@yarnpkg/fslib';
import {exec}                               from 'pkg-tests-core';

describe(`Commands`, () => {
  describe(`version`, () => {
    describe(`immediate mode`, () => {
      test(
        `it should apply incremental strategy to a workspace`,
        makeTemporaryEnv({
          version: `1.2.3`,
        }, async ({path, run, source}) => {
          await run(`version`, `patch`);
          await expect(xfs.readJsonPromise(`${path}/package.json` as PortablePath)).resolves.toMatchObject({
            version: `1.2.4`,
          });

          await run(`version`, `minor`);
          await expect(xfs.readJsonPromise(`${path}/package.json` as PortablePath)).resolves.toMatchObject({
            version: `1.3.0`,
          });

          await run(`version`, `major`);
          await expect(xfs.readJsonPromise(`${path}/package.json` as PortablePath)).resolves.toMatchObject({
            version: `2.0.0`,
          });
        }),
      );

      test(
        `it should apply semver strategy to a workspace`,
        makeTemporaryEnv({
          version: `1.2.3`,
        }, async ({path, run, source}) => {
          await expect(run(`version`, `3.4.5`)).resolves.toMatchObject({
            code: 0,
          });

          await expect(xfs.readJsonPromise(`${path}/package.json` as PortablePath)).resolves.toMatchObject({
            version: `3.4.5`,
          });
        }),
      );

      test(
        `it should not bump a workspace when applying the "decline" strategy`,
        makeTemporaryEnv({
          version: `1.2.3`,
        }, async ({path, run, source}) => {
          await run(`version`, `decline`);
          await expect(xfs.readJsonPromise(`${path}/package.json` as PortablePath)).resolves.toMatchObject({
            version: `1.2.3`,
          });
        }),
      );

      const BUMPS = {
        stable: {from: `1.2.3`, prepatch: `1.2.4-0`, preminor: `1.3.0-0`, premajor: `2.0.0-0`},
        prepatch: {from: `1.2.3-9`, prepatch: `1.2.3-10`, preminor: `1.3.0-0`, premajor: `2.0.0-0`},
        preminor: {from: `1.2.0-9`, prepatch: `1.2.0-10`, preminor: `1.2.0-10`, premajor: `2.0.0-0`},
        premajor: {from: `1.0.0-9`, prepatch: `1.0.0-10`, preminor: `1.0.0-10`, premajor: `1.0.0-10`},
      };

      for (const strategy of [`prepatch`, `preminor`, `premajor`] as const) {
        for (const [base, versions] of Object.entries(BUMPS)) {
          const isPrereleaseBump = versions[strategy].endsWith(`-10`);
          test(
            isPrereleaseBump
              ? `it should bump a ${base} version to the next prerelease when applying the "${strategy}" strategy`
              : `it should bump a ${base} version to a prerelease of the next ${strategy.slice(3)} version when applying the "${strategy}" strategy`,
            makeTemporaryEnv({
              version: versions.from,
            }, async ({path, run, source}) => {
              await run(`version`, strategy);

              await expect(xfs.readJsonPromise(`${path}/package.json` as PortablePath)).resolves.toMatchObject({
                version: versions[strategy],
              });
            }),
          );
        }
      }

      test(
        `it should bump a stable version to a prerelease of the next patch version when applying the "prerelease" strategy`,
        makeTemporaryEnv({
          version: `1.2.3`,
        }, async ({path, run, source}) => {
          await run(`version`, `prerelease`);

          await expect(xfs.readJsonPromise(`${path}/package.json` as PortablePath)).resolves.toMatchObject({
            version: `1.2.4-0`,
          });
        }),
      );

      test(
        `it should bump a prerelease version to the next prerelease when applying the "prerelease" strategy`,
        makeTemporaryEnv({
          version: `1.2.3-9`,
        }, async ({path, run, source}) => {
          await run(`version`, `prerelease`);

          await expect(xfs.readJsonPromise(`${path}/package.json` as PortablePath)).resolves.toMatchObject({
            version: `1.2.3-10`,
          });
        }),
      );

      test(
        `it shouldn't work if the strategy isn't semver and there is no prior version`,
        makeTemporaryEnv({}, async ({path, run, source}) => {
          await expect(run(`version`, `patch`)).rejects.toThrow(`Usage Error: Can't bump the version if there wasn't a version to begin with - use 0.0.0 as initial version then run the command again.`);
        }),
      );

      test(
        `it should throw when applying an invalid strategy`,
        makeTemporaryEnv({
          version: `1.0.0`,
        }, async ({path, run, source}) => {
          await expect(run(`version`, `invalid`)).rejects.toThrow(`Invalid value for enumeration: "invalid"`);
        }),
      );

      test(
        `it should throw when trying to bump to a lower version than the current one`,
        makeTemporaryEnv({
          version: `1.2.3`,
        }, async ({path, run, source}) => {
          await expect(run(`version`, `1.0.0`)).rejects.toThrow(/lower/);
        }),
      );

      test(
        `it should bump to a lower version than the current one if --force is set`,
        makeTemporaryEnv({
          version: `1.2.3`,
        }, async ({path, run, source}) => {
          await expect(run(`version`, `1.0.0`, `--force`)).resolves.toMatchObject({
            code: 0,
          });

          await expect(xfs.readJsonPromise(`${path}/package.json` as PortablePath)).resolves.toMatchObject({
            version: `1.0.0`,
          });
        }),
      );

      test(
        `it should bump the last numeric prerelease identifier if --prerelease is not set when applying the "prerelease" strategy`,
        makeTemporaryEnv({
          version: `1.2.3-a.1.b.2.c`,
        }, async ({path, run, source}) => {
          await run(`version`, `prerelease`);

          await expect(xfs.readJsonPromise(`${path}/package.json` as PortablePath)).resolves.toMatchObject({
            version: `1.2.3-a.1.b.3.c`,
          });
        }),
      );

      test(
        `it should bump the prerelease identifiers specified by the --prerelease pattern when applying the "prerelease" strategy`,
        makeTemporaryEnv({
          version: `1.2.3-a.1.b.2.c`,
        }, async ({path, run, source}) => {
          await run(`version`, `prerelease`, `--prerelease=a.%n.b.%n.c`);

          await expect(xfs.readJsonPromise(`${path}/package.json` as PortablePath)).resolves.toMatchObject({
            version: `1.2.3-a.2.b.3.c`,
          });
        }),
      );

      test(
        `it should restart the prerelease sequence if the --prerelease pattern does not match when applying the "prerelease" strategy`,
        makeTemporaryEnv({
          version: `1.2.3-alpha.999`,
        }, async ({path, run, source}) => {
          await run(`version`, `prerelease`, `--prerelease=beta.%n`);

          await expect(xfs.readJsonPromise(`${path}/package.json` as PortablePath)).resolves.toMatchObject({
            version: `1.2.3-beta.1`,
          });
        }),
      );

      test(
        `it should restart the prerelease sequence if the --prerelease template is a partial match when applying the "prerelease" strategy`,
        makeTemporaryEnv({
          version: `1.2.3-a.1.b.2.c`,
        }, async ({path, run, source}) => {
          await run(`version`, `prerelease`, `--prerelease=a.%n.b.c.%n`);

          await expect(xfs.readJsonPromise(`${path}/package.json` as PortablePath)).resolves.toMatchObject({
            version: `1.2.3-a.1.b.c.1`,
          });
        }),
      );

      test(
        `it should immediately bump the version when using --immediate, even if preferDeferredVersions is set`,
        makeTemporaryEnv({
          version: `1.2.3`,
        }, {
          preferDeferredVersions: true,
        }, async ({path, run, source}) => {
          await run(`version`, `patch`, `--immediate`);

          await expect(xfs.readJsonPromise(`${path}/package.json` as PortablePath)).resolves.toMatchObject({
            version: `1.2.4`,
          });
        }),
      );

      test(
        `it should bump all workspaces when using --all`,
        makeTemporaryEnv(
          {
            version: `1.2.3`,
            workspaces: [
              `packages/*`,
            ],
          },
          async ({path, run, source}) => {
            const pkgA = ppath.join(path, `packages/pkg-a`);
            await xfs.mkdirpPromise(pkgA);
            await xfs.writeJsonPromise(ppath.join(pkgA, Filename.manifest), {
              name: `pkg-a`,
              version: `4.5.6`,
            });

            const pkgB = ppath.join(path, `packages/pkg-b`);
            await xfs.mkdirpPromise(pkgB);
            await xfs.writeJsonPromise(ppath.join(pkgB, Filename.manifest), {
              name: `pkg-b`,
              version: `7.8.9`,
            });

            await run(`install`);
            await run(`version`, `patch`, `--all`);

            await expect(xfs.readJsonPromise(ppath.join(pkgA, Filename.manifest))).resolves.toMatchObject({
              version: `4.5.7`,
            });

            await expect(xfs.readJsonPromise(ppath.join(pkgB, Filename.manifest))).resolves.toMatchObject({
              version: `7.8.10`,
            });
          }),
      );

      test(
        `it should recursively bump dependent workspaces when using --recursive`,
        makeTemporaryEnv(
          {
            version: `0.0.0`,
            workspaces: [
              `packages/*`,
            ],
          },
          async ({path, run, source}) => {
            const pkgA = ppath.join(path, `packages/pkg-a`);
            await xfs.mkdirpPromise(pkgA);
            await xfs.writeJsonPromise(ppath.join(pkgA, Filename.manifest), {
              name: `pkg-a`,
              version: `1.2.3`,
              dependencies: {
                [`pkg-b`]: `workspace:*`,
                [`pkg-d`]: `workspace:*`,
              },
            });

            const pkgB = ppath.join(path, `packages/pkg-b`);
            await xfs.mkdirpPromise(pkgB);
            await xfs.writeJsonPromise(ppath.join(pkgB, Filename.manifest), {
              name: `pkg-b`,
              version: `4.5.6`,
              dependencies: {
                [`pkg-c`]: `workspace:*`,
              },
            });

            const pkgC = ppath.join(path, `packages/pkg-c`);
            await xfs.mkdirpPromise(pkgC);
            await xfs.writeJsonPromise(ppath.join(pkgC, Filename.manifest), {
              name: `pkg-c`,
              version: `7.8.9`,
            });

            const pkgD = ppath.join(path, `packages/pkg-d`);
            await xfs.mkdirpPromise(pkgD);
            await xfs.writeJsonPromise(ppath.join(pkgD, Filename.manifest), {
              name: `pkg-d`,
              version: `10.11.12`,
            });

            const pkgE = ppath.join(path, `packages/pkg-e`);
            await xfs.mkdirpPromise(pkgE);
            await xfs.writeJsonPromise(ppath.join(pkgE, Filename.manifest), {
              name: `pkg-e`,
              version: `13.14.15`,
            });

            await run(`install`);
            await run(`workspace`, `pkg-a`, `version`, `patch`, `--recursive`);

            await expect(xfs.readJsonPromise(ppath.join(path, Filename.manifest))).resolves.toMatchObject({
              version: `0.0.0`,
            });
            await expect(xfs.readJsonPromise(ppath.join(pkgA, Filename.manifest))).resolves.toMatchObject({
              version: `1.2.4`,
            });
            await expect(xfs.readJsonPromise(ppath.join(pkgB, Filename.manifest))).resolves.toMatchObject({
              version: `4.5.7`,
            });
            await expect(xfs.readJsonPromise(ppath.join(pkgC, Filename.manifest))).resolves.toMatchObject({
              version: `7.8.10`,
            });
            await expect(xfs.readJsonPromise(ppath.join(pkgD, Filename.manifest))).resolves.toMatchObject({
              version: `10.11.13`,
            });
            await expect(xfs.readJsonPromise(ppath.join(pkgE, Filename.manifest))).resolves.toMatchObject({
              version: `13.14.15`,
            });
          }),
      );

      test(
        `it should update workspace references when applying version changes`,
        makeTemporaryEnv(
          {
            workspaces: [
              `packages/*`,
            ],
          },
          async ({path, run, source}) => {
            const pkgA = ppath.join(path, `packages/pkg-a`);
            await xfs.mkdirpPromise(pkgA);
            await xfs.writeJsonPromise(ppath.join(pkgA, Filename.manifest), {
              name: `pkg-a`,
              version: `1.2.3`,
              dependencies: {
                [`pkg-b`]: `workspace:4.5.6`,
                [`pkg-c`]: `workspace:^7.0.0`,
              },
            });

            const pkgB = ppath.join(path, `packages/pkg-b`);
            await xfs.mkdirpPromise(pkgB);
            await xfs.writeJsonPromise(ppath.join(pkgB, Filename.manifest), {
              name: `pkg-b`,
              version: `4.5.6`,
            });

            const pkgC = ppath.join(path, `packages/pkg-c`);
            await xfs.mkdirpPromise(pkgC);
            await xfs.writeJsonPromise(ppath.join(pkgC, Filename.manifest), {
              name: `pkg-c`,
              version: `7.8.9`,
            });

            await run(`install`);
            await run(`workspace`, `pkg-b`, `version`, `patch`);
            await run(`workspace`, `pkg-c`, `version`, `minor`);

            await expect(xfs.readJsonPromise(ppath.join(pkgA, Filename.manifest))).resolves.toMatchObject({
              dependencies: {
                [`pkg-b`]: `workspace:4.5.7`,
                [`pkg-c`]: `workspace:^7.9.0`,
              },
            });
          }),
      );

      test(
        `it should remove range from workspace references when using --exact`,
        makeTemporaryEnv(
          {
            workspaces: [
              `packages/*`,
            ],
          },
          async ({path, run, source}) => {
            const pkgA = ppath.join(path, `packages/pkg-a`);
            await xfs.mkdirpPromise(pkgA);
            await xfs.writeJsonPromise(ppath.join(pkgA, Filename.manifest), {
              name: `pkg-a`,
              version: `1.2.3`,
              dependencies: {
                [`pkg-b`]: `workspace:^4.0.0`,
              },
            });

            const pkgB = ppath.join(path, `packages/pkg-b`);
            await xfs.mkdirpPromise(pkgB);
            await xfs.writeJsonPromise(ppath.join(pkgB, Filename.manifest), {
              name: `pkg-b`,
              version: `4.5.6`,
            });

            await run(`install`);
            await run(`workspace`, `pkg-b`, `version`, `patch`, `--exact`);

            await expect(xfs.readJsonPromise(ppath.join(pkgA, Filename.manifest))).resolves.toMatchObject({
              dependencies: {
                [`pkg-b`]: `workspace:4.5.7`,
              },
            });
          }),
      );

      test(
        `it should correctly report a dependent workspace when unable to upgrade its version.`,
        makeTemporaryEnv(
          {
            private: true,
            workspaces: [
              `packages/*`,
            ],
          },
          async ({path, run, source}) => {
            // Create the primary package.
            const pkgPrimary = ppath.join(path, `packages/pkg-primary`);
            await xfs.mkdirpPromise(pkgPrimary);
            await xfs.writeJsonPromise(ppath.join(pkgPrimary, Filename.manifest), {
              name: `pkg-primary`,
              version: `1.0.0`,
            });

            // Create the dependant package.
            const pkgDependant = ppath.join(path, `packages/pkg-dependant`);
            await xfs.mkdirpPromise(pkgDependant);
            await xfs.writeJsonPromise(ppath.join(pkgDependant, Filename.manifest), {
              name: `pkg-dependant`,
              version: `1.0.0`,
              dependencies: {
                [`pkg-primary`]: `workspace:*`,
              },
            });

            await run(`install`);

            await expect(run(`workspace`, `pkg-primary`, `version`, `patch`)).resolves.toMatchObject({
              code: 0,
              stdout: expect.stringContaining(`Couldn't auto-upgrade range * (in pkg-dependant@workspace:packages/pkg-dependant)`),
            });
          }),
      );

      test(
        `it should not actually bump when --dry-run is set`,
        makeTemporaryEnv({
          version: `1.2.3`,
        }, async ({path, run, source}) => {
          await expect(run(`version`, `patch`, `--dry-run`)).resolves.toMatchObject({
            code: 0,
            stdout: expect.stringContaining(`1.2.4`),
          });

          await expect(xfs.readJsonPromise(`${path}/package.json` as PortablePath)).resolves.toMatchObject({
            version: `1.2.3`,
          });
        }),
      );

      test(
        `it should work outside of a git repository`,
        makeTemporaryEnv({
          version: `1.2.3`,
        }, async ({path, run, source}) => {
          await expect(xfs.existsPromise(ppath.join(path, `.git`))).resolves.toBe(false);

          await run(`version`, `patch`, `--immediate`);

          await expect(xfs.readJsonPromise(`${path}/package.json` as PortablePath)).resolves.toMatchObject({
            version: `1.2.4`,
          });
        }),
      );

      test(
        `it should work in a newly-initialized git repository`,
        makeTemporaryEnv({
          version: `1.2.3`,
        }, async ({path, run, source}) => {
          await exec.execGitInit({cwd: path});

          await run(`version`, `patch`, `--immediate`);

          await expect(xfs.readJsonPromise(`${path}/package.json` as PortablePath)).resolves.toMatchObject({
            version: `1.2.4`,
          });
        }),
      );
    });

    describe(`deferred mode`, () => {
      test(
        `it should apply a deferred incremental strategy to a workspace`,
        makeTemporaryEnv({
          version: `1.2.3`,
        }, async ({path, run, source}) => {
          await run(`version`, `patch`, `--deferred`);
          await run(`version`, `apply`);

          await expect(xfs.readJsonPromise(`${path}/package.json` as PortablePath)).resolves.toMatchObject({
            version: `1.2.4`,
          });
        }),
      );

      test(
        `it should apply a deferred semver strategy to a workspace`,
        makeTemporaryEnv({
          version: `1.2.3`,
        }, async ({path, run, source}) => {
          await run(`version`, `4.5.6`, `--deferred`);
          await run(`version`, `apply`);

          await expect(xfs.readJsonPromise(`${path}/package.json` as PortablePath)).resolves.toMatchObject({
            version: `4.5.6`,
          });
        }),
      );

      test(
        `it should apply the highest deferred bump when multiple deferred bumps are recorded`,
        makeTemporaryEnv({
          version: `1.2.3`,
        }, async ({path, run, source}) => {
          await run(`version`, `patch`, `--deferred`);
          await run(`version`, `major`, `--deferred`);
          await run(`version`, `minor`, `--deferred`);
          await run(`version`, `apply`);

          await expect(xfs.readJsonPromise(`${path}/package.json` as PortablePath)).resolves.toMatchObject({
            version: `2.0.0`,
          });

          await run(`version`, `minor`, `--deferred`);
          await run(`version`, `2.1.3-rc.1`, `--deferred`);
          await run(`version`, `apply`);

          await expect(xfs.readJsonPromise(`${path}/package.json` as PortablePath)).resolves.toMatchObject({
            version: `2.1.3-rc.1`,
          });
        }),
      );

      test(
        `it should throw when deferring an invalid strategy`,
        makeTemporaryEnv({
          version: `1.0.0`,
        }, async ({path, run, source}) => {
          await expect(run(`version`, `invalid`, `--deferred`)).rejects.toThrow(`Invalid value for enumeration: "invalid"`);
        }),
      );

      test(
        `it should throw when trying to defer a lower version than the current one`,
        makeTemporaryEnv({
          version: `1.2.3`,
        }, async ({path, run, source}) => {
          await expect(run(`version`, `1.0.0`, `--deferred`)).rejects.toThrow(/lower/);
        }),
      );

      test(
        `it should defer a lower version than the current one if --force is set`,
        makeTemporaryEnv({
          version: `1.2.3`,
        }, async ({path, run, source}) => {
          await expect(run(`version`, `1.0.0`, `--deferred`, `--force`)).resolves.toMatchObject({
            code: 0,
          });
        }),
      );

      test(
        `it should throw when trying to apply a lower version than the current one`,
        makeTemporaryEnv({
          version: `1.2.3`,
        }, async ({path, run, source}) => {
          await run(`version`, `1.0.0`, `--deferred`, `--force`);
          await expect(run(`version`, `apply`)).rejects.toThrow(/lower/);
        }),
      );

      test(
        `it should apply a lower version than the current one if --force is set`,
        makeTemporaryEnv({
          version: `1.2.3`,
        }, async ({path, run, source}) => {
          await run(`version`, `1.0.0`, `--deferred`, `--force`);

          await expect(run(`version`, `apply`, `--force`)).resolves.toMatchObject({
            code: 0,
          });

          await expect(xfs.readJsonPromise(`${path}/package.json` as PortablePath)).resolves.toMatchObject({
            version: `1.0.0`,
          });
        }),
      );

      test(
        `it shouldn't immediately bump the version when using --deferred`,
        makeTemporaryEnv({
          version: `1.2.3`,
        }, async ({path, run, source}) => {
          await run(`version`, `patch`, `--deferred`);

          await expect(xfs.readJsonPromise(`${path}/package.json` as PortablePath)).resolves.toMatchObject({
            version: `1.2.3`,
          });
        }),
      );

      test(
        `it shouldn't immediately bump the version when preferDeferredVersions is set`,
        makeTemporaryEnv({
          version: `1.2.3`,
        }, {
          preferDeferredVersions: true,
        }, async ({path, run, source}) => {
          await run(`version`, `patch`);

          await expect(xfs.readJsonPromise(`${path}/package.json` as PortablePath)).resolves.toMatchObject({
            version: `1.2.3`,
          });
        }),
      );

      test(
        `it shouldn't record the version bump when --dry-run is set`,
        makeTemporaryEnv({
          version: `1.2.3`,
        }, async ({path, run, source}) => {
          await run(`version`, `patch`, `--deferred`, `--dry-run`);
          await run(`version`, `apply`);

          await expect(xfs.readJsonPromise(`${path}/package.json` as PortablePath)).resolves.toMatchObject({
            version: `1.2.3`,
          });
        }),
      );
    });

    describe(`mixed mode`, () => {
      test(
        `it shouldn't work if the immediate bump would be lower than the planned version (incremental strategy)`,
        makeTemporaryEnv({
          version: `1.2.3`,
        }, async ({path, run, source}) => {
          await run(`version`, `major`, `--deferred`);
          await expect(run(`version`, `patch`)).rejects.toThrow(`Usage Error: Can't bump the version to one that would be lower than the current deferred one (2.0.0)`);
        }),
      );

      test(
        `it shouldn't work if the immediate bump would be lower than the planned version (semver strategy)`,
        makeTemporaryEnv({
          version: `1.2.3`,
        }, async ({path, run, source}) => {
          await run(`version`, `major`, `--deferred`);
          await expect(run(`version`, `1.4.5`)).rejects.toThrow(`Usage Error: Can't bump the version to one that would be lower than the current deferred one (2.0.0)`);
        }),
      );

      test(
        `it should work if the immediate bump is equal to the planned version (incremental strategy)`,
        makeTemporaryEnv({
          version: `1.2.3`,
        }, async ({path, run, source}) => {
          await run(`version`, `1.3.0`, `--deferred`);
          await run(`version`, `minor`);

          await expect(xfs.readJsonPromise(`${path}/package.json` as PortablePath)).resolves.toMatchObject({
            version: `1.3.0`,
          });
        }),
      );

      test(
        `it should work if the immediate bump is equal to the planned version (semver strategy)`,
        makeTemporaryEnv({
          version: `1.2.3`,
        }, async ({path, run, source}) => {
          await run(`version`, `minor`, `--deferred`);
          await run(`version`, `1.3.0`);

          await expect(xfs.readJsonPromise(`${path}/package.json` as PortablePath)).resolves.toMatchObject({
            version: `1.3.0`,
          });
        }),
      );

      test(
        `it should work if the immediate bump is greater than the planned version (incremental strategy)`,
        makeTemporaryEnv({
          version: `1.2.3`,
        }, async ({path, run, source}) => {
          await run(`version`, `minor`, `--deferred`);
          await run(`version`, `major`);

          await expect(xfs.readJsonPromise(`${path}/package.json` as PortablePath)).resolves.toMatchObject({
            version: `2.0.0`,
          });
        }),
      );

      test(
        `it should work if the immediate bump is greater than the planned version (semver strategy)`,
        makeTemporaryEnv({
          version: `1.2.3`,
        }, async ({path, run, source}) => {
          await run(`version`, `minor`, `--deferred`);
          await run(`version`, `3.4.5`);

          await expect(xfs.readJsonPromise(`${path}/package.json` as PortablePath)).resolves.toMatchObject({
            version: `3.4.5`,
          });
        }),
      );

      test(
        `it should successfully apply "decline" on top of the stored version`,
        makeTemporaryEnv({
          version: `1.0.0`,
        }, async ({path, run, source}) => {
          await run(`version`, `major`, `--deferred`);

          await expect(run(`version`, `decline`)).resolves.toMatchObject({
            code: 0,
          });

          await expect(xfs.readJsonPromise(`${path}/package.json` as PortablePath)).resolves.toMatchObject({
            version: `2.0.0`,
          });
        }),
      );

      test(
        `it should throw when applying an invalid strategy on top of the stored version`,
        makeTemporaryEnv({
          version: `1.0.0`,
        }, async ({path, run, source}) => {
          await run(`version`, `major`, `--deferred`);

          await expect(run(`version`, `invalid`)).rejects.toThrow(`Invalid value for enumeration: "invalid"`);
        }),
      );

      test(
        `it should work if the immediate bump is lower than the planned version when --force is set (incremental strategy)`,
        makeTemporaryEnv({
          version: `1.2.3`,
        }, async ({path, run, source}) => {
          await run(`version`, `major`, `--deferred`);
          await expect(run(`version`, `patch`, `--force`)).resolves.toMatchObject({
            code: 0,
          });

          await expect(xfs.readJsonPromise(`${path}/package.json` as PortablePath)).resolves.toMatchObject({
            version: `1.2.4`,
          });
        }),
      );

      test(
        `it should work if the immediate bump is lower than the planned version when --force is set (semver strategy)`,
        makeTemporaryEnv({
          version: `1.2.3`,
        }, async ({path, run, source}) => {
          await run(`version`, `major`, `--deferred`);
          await expect(run(`version`, `1.4.5`, `--force`)).resolves.toMatchObject({
            code: 0,
          });

          await expect(xfs.readJsonPromise(`${path}/package.json` as PortablePath)).resolves.toMatchObject({
            version: `1.4.5`,
          });
        }),
      );
    });
  });
});
