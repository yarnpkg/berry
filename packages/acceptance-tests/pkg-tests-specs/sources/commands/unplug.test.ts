import {xfs}  from '@yarnpkg/fslib';
import {yarn} from 'pkg-tests-core';

const {readManifest} = yarn;

const unplugged = {
  unplugged: true,
};

describe(`Commands`, () => {
  describe(`unplug`, () => {
    test(
      `it should unplug all dependencies satisfying a range`,
      makeTemporaryEnv({
        dependencies: {
          [`first`]: `npm:no-deps@1.0.0`,
          [`second`]: `npm:no-deps@1.0.1`,
          [`third`]: `npm:no-deps@1.1.0`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        await run(`unplug`, `no-deps@~1.0`);

        await expect(readManifest(path)).resolves.toMatchObject({
          dependenciesMeta: {
            [`no-deps@1.0.0`]: unplugged,
            [`no-deps@1.0.1`]: unplugged,
          },
        });
      }),
    );

    test(
      `it should unplug all dependencies matching a glob pattern`,
      makeTemporaryEnv({
        dependencies: {
          [`@types/is-number`]: `1.0.0`,
          [`@types/no-deps`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        await run(`unplug`, `@types/*`);

        await expect(readManifest(path)).resolves.toMatchObject({
          dependenciesMeta: {
            [`@types/is-number@1.0.0`]: unplugged,
            [`@types/no-deps@1.0.0`]: unplugged,
          },
        });
      }),
    );

    test(
      `it should respect the \`-A,--all\` flag`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps`]: `2.0.0`,
          [`one-range-dep`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        await run(`unplug`, `no-deps`);

        await expect(readManifest(path)).resolves.toMatchObject({
          dependenciesMeta: {
            [`no-deps@2.0.0`]: unplugged,
          },
        });

        await run(`unplug`, `no-deps`, `--all`);

        await expect(readManifest(path)).resolves.toMatchObject({
          dependenciesMeta: {
            [`no-deps@1.1.0`]: unplugged,
            [`no-deps@2.0.0`]: unplugged,
          },
        });
      }),
    );

    test(
      `it should respect the \`--json\` flag`,
      makeTemporaryEnv({
        dependencies: {
          [`@types/is-number`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        const {stdout} = await run(`unplug`, `@types/*`, `--json`);
        const json = JSON.parse(stdout.trim());

        expect(json).toStrictEqual({
          pattern: `@types/*`,
          locator: `@types/is-number@npm:1.0.0`,
          version: `1.0.0`,
        });
      }),
    );
  });
});
