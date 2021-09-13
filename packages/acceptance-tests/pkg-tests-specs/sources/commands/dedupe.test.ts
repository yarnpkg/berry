import {tests} from 'pkg-tests-core';

const {setPackageWhitelist} = tests;

describe(`Commands`, () => {
  describe(`dedupe`, () => {
    it(
      `should include a footer`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await setPackageWhitelist(new Map([
          [`no-deps`, new Set([`1.0.0`])],
          [`@types/is-number`, new Set([`1.0.0`])],
        ]), async () => {
          await run(`add`, `two-range-deps`);
        });

        await run(`add`, `no-deps@1.1.0`, `@types/is-number@2.0.0`);

        await expect(run(`dedupe`, `--check`)).rejects.toMatchObject({
          stdout: expect.stringContaining(`2 packages can be deduped using the highest strategy`),
        });
      }),
    );

    describe(`strategies`, () => {
      describe(`highest`, () => {
        it(
          `should dedupe dependencies`,
          makeTemporaryEnv({}, async ({path, run, source}) => {
            await setPackageWhitelist(new Map([[`no-deps`, new Set([`1.0.0`])]]), async () => {
              await run(`add`, `one-range-dep`);
            });

            await run(`add`, `no-deps@1.1.0`);

            await run(`dedupe`);

            await expect(run(`dedupe`, `--check`)).resolves.toMatchObject({
              code: 0,
            });

            await expect(source(`require('no-deps')`)).resolves.toMatchObject({
              version: `1.1.0`,
            });
            await expect(source(`require('one-range-dep')`)).resolves.toMatchObject({
              dependencies: {
                [`no-deps`]: {
                  version: `1.1.0`,
                },
              },
            });
          }),
        );

        it(
          `should dedupe dependencies to the highest possible version`,
          makeTemporaryEnv({}, async ({path, run, source}) => {
            await setPackageWhitelist(new Map([[`no-deps`, new Set([`1.0.0`])]]), async () => {
              await run(`add`, `one-range-dep`, `one-range-dep-too`);
            });

            await run(`add`, `no-deps@1.1.0`);

            await run(`dedupe`);

            await expect(source(`require('no-deps')`)).resolves.toMatchObject({
              version: `1.1.0`,
            });
            await expect(source(`require('one-range-dep')`)).resolves.toMatchObject({
              dependencies: {
                [`no-deps`]: {
                  version: `1.1.0`,
                },
              },
            });
            await expect(source(`require('one-range-dep-too')`)).resolves.toMatchObject({
              dependencies: {
                [`no-deps`]: {
                  version: `1.1.0`,
                },
              },
            });
          }),
        );
      });
    });

    describe(`patterns`, () => {
      it(
        `should support selective dedupe (ident)`,
        makeTemporaryEnv({}, async ({path, run, source}) => {
          await setPackageWhitelist(new Map([
            [`no-deps`, new Set([`1.0.0`])],
            [`@types/is-number`, new Set([`1.0.0`])],
          ]), async () => {
            await run(`add`, `two-range-deps`);
          });

          await run(`add`, `no-deps@1.1.0`, `@types/is-number@2.0.0`);

          await run(`dedupe`, `no-deps`);

          await expect(source(`require('two-range-deps')`)).resolves.toMatchObject({
            dependencies: {
              [`no-deps`]: {
                version: `1.1.0`,
              },
              [`@types/is-number`]: {
                version: `1.0.0`,
              },
            },
          });
        }),
      );

      it(
        `should support selective dedupe (scoped ident)`,
        makeTemporaryEnv({}, async ({path, run, source}) => {
          await setPackageWhitelist(new Map([
            [`no-deps`, new Set([`1.0.0`])],
            [`@types/is-number`, new Set([`1.0.0`])],
          ]), async () => {
            await run(`add`, `two-range-deps`);
          });

          await run(`add`, `no-deps@1.1.0`, `@types/is-number@2.0.0`);

          await run(`dedupe`, `@types/is-number`);

          await expect(source(`require('two-range-deps')`)).resolves.toMatchObject({
            dependencies: {
              [`no-deps`]: {
                version: `1.0.0`,
              },
              [`@types/is-number`]: {
                version: `2.0.0`,
              },
            },
          });
        }),
      );

      it(
        `should support selective dedupe (ident glob)`,
        makeTemporaryEnv({}, async ({path, run, source}) => {
          await setPackageWhitelist(new Map([
            [`no-deps`, new Set([`1.0.0`])],
            [`@types/is-number`, new Set([`1.0.0`])],
          ]), async () => {
            await run(`add`, `two-range-deps`);
          });

          await run(`add`, `no-deps@1.1.0`, `@types/is-number@2.0.0`);

          await run(`dedupe`, `no-*`);

          await expect(source(`require('two-range-deps')`)).resolves.toMatchObject({
            dependencies: {
              [`no-deps`]: {
                version: `1.1.0`,
              },
              [`@types/is-number`]: {
                version: `1.0.0`,
              },
            },
          });
        }),
      );

      it(
        `should support selective dedupe (scoped ident glob)`,
        makeTemporaryEnv({}, async ({path, run, source}) => {
          await setPackageWhitelist(new Map([
            [`no-deps`, new Set([`1.0.0`])],
            [`@types/is-number`, new Set([`1.0.0`])],
          ]), async () => {
            await run(`add`, `two-range-deps`);
          });

          await run(`add`, `no-deps@1.1.0`, `@types/is-number@2.0.0`);

          await run(`dedupe`, `@types/*`);

          await expect(source(`require('two-range-deps')`)).resolves.toMatchObject({
            dependencies: {
              [`no-deps`]: {
                version: `1.0.0`,
              },
              [`@types/is-number`]: {
                version: `2.0.0`,
              },
            },
          });
        }),
      );
    });

    describe(`flags`, () => {
      describe(`-c,--check`, () => {
        it(
          `should reject with error code 1 when there are duplicates`,
          makeTemporaryEnv({}, async ({path, run, source}) => {
            await setPackageWhitelist(new Map([[`no-deps`, new Set([`1.0.0`])]]), async () => {
              await run(`add`, `one-range-dep`);
            });

            await run(`add`, `no-deps@1.1.0`);

            await expect(run(`dedupe`, `--check`)).rejects.toMatchObject({
              code: 1,
            });
          }),
        );

        it(
          `should resolve with error code 0 when there are no duplicates`,
          makeTemporaryEnv({}, async ({path, run, source}) => {
            await setPackageWhitelist(new Map([[`no-deps`, new Set([`1.0.0`])]]), async () => {
              await run(`add`, `one-range-dep`);
            });

            await run(`add`, `no-deps@2.0.0`);

            await expect(run(`dedupe`, `--check`)).resolves.toMatchObject({
              code: 0,
            });
          }),
        );
      });

      test(
        `--json`,
        makeTemporaryEnv({}, async ({path, run, source}) => {
          await setPackageWhitelist(new Map([[`no-deps`, new Set([`1.0.0`])]]), async () => {
            await run(`add`, `one-range-dep`);
          });

          await run(`add`, `no-deps@1.1.0`);

          // We also use the check flag so that the stdout doesn't include the install report
          await run(`dedupe`, `--json`, `--check`).catch(({stdout}) => {
            expect(JSON.parse(stdout.trim())).toMatchObject({
              descriptor: `no-deps@npm:^1.0.0`,
              currentResolution: `no-deps@npm:1.0.0`,
              updatedResolution: `no-deps@npm:1.1.0`,
            });
          });

          expect.assertions(1);
        }),
      );

      test(
        `-s,--strategy`,
        makeTemporaryEnv({}, async ({path, run, source}) => {
          await setPackageWhitelist(new Map([[`no-deps`, new Set([`1.0.0`])]]), async () => {
            await run(`add`, `one-range-dep`);
          });

          await run(`add`, `no-deps@1.1.0`);

          await expect(run(`dedupe`, `--check`, `--strategy`, `highest`)).rejects.toMatchObject({
            code: 1,
          });
        }),
      );
    });
  });
});
