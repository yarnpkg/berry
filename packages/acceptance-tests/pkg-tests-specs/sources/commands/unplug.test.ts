import {xfs, ppath, PortablePath} from '@yarnpkg/fslib';
import {yarn}                     from 'pkg-tests-core';

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

        await expect(readManifest(path, {key: `dependenciesMeta`})).resolves.toEqual({
          [`no-deps@1.0.0`]: unplugged,
          [`no-deps@1.0.1`]: unplugged,
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

        await expect(readManifest(path, {key: `dependenciesMeta`})).resolves.toEqual({
          [`@types/is-number@1.0.0`]: unplugged,
          [`@types/no-deps@1.0.0`]: unplugged,
        });
      }),
    );

    test(
      `it should respect the \`-R,--recursive\` flag`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps`]: `2.0.0`,
          [`one-fixed-dep`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        await run(`unplug`, `no-deps`);

        await expect(readManifest(path, {key: `dependenciesMeta`})).resolves.toEqual({
          [`no-deps@2.0.0`]: unplugged,
        });

        await run(`unplug`, `no-deps`, `--recursive`);

        await expect(readManifest(path, {key: `dependenciesMeta`})).resolves.toEqual({
          [`no-deps@2.0.0`]: unplugged,
          [`no-deps@1.0.0`]: unplugged,
        });
      }),
    );

    test(
      `it should respect the \`-A,--all\` flag`,
      makeTemporaryEnv({
        private: true,
        workspaces: [
          `packages/*`,
        ],
      }, async ({path, run, source}) => {
        await xfs.mkdirpPromise(ppath.join(path, `packages/foo` as PortablePath));
        await xfs.mkdirpPromise(ppath.join(path, `packages/bar` as PortablePath));

        await xfs.writeJsonPromise(ppath.join(path, `packages/foo/package.json` as PortablePath), {
          dependencies: {
            [`no-deps`]: `1.0.0`,
          },
        });

        await xfs.writeJsonPromise(ppath.join(path, `packages/bar/package.json` as PortablePath), {
          dependencies: {
            [`no-deps`]: `2.0.0`,
          },
        });

        await run(`install`);

        await run(`unplug`, `no-deps`, {
          cwd: ppath.join(path, `packages/foo` as PortablePath),
        });

        await expect(readManifest(path, {key: `dependenciesMeta`})).resolves.toEqual({
          [`no-deps@1.0.0`]: unplugged,
        });

        await run(`unplug`, `no-deps`, `--all`, {
          cwd: ppath.join(path, `packages/foo` as PortablePath),
        });

        await expect(readManifest(path, {key: `dependenciesMeta`})).resolves.toEqual({
          [`no-deps@1.0.0`]: unplugged,
          [`no-deps@2.0.0`]: unplugged,
        });
      }),
    );

    test(
      `it should respect the \`-A,--all\` and \`-R,--recursive\` flags put together`,
      makeTemporaryEnv({
        private: true,
        workspaces: [
          `packages/*`,
        ],
      }, async ({path, run, source}) => {
        await xfs.mkdirpPromise(ppath.join(path, `packages/foo` as PortablePath));
        await xfs.mkdirpPromise(ppath.join(path, `packages/bar` as PortablePath));

        await xfs.writeJsonPromise(ppath.join(path, `packages/foo/package.json` as PortablePath), {
          dependencies: {
            [`no-deps`]: `1.0.0`,
          },
        });

        await xfs.writeJsonPromise(ppath.join(path, `packages/bar/package.json` as PortablePath), {
          dependencies: {
            [`one-fixed-dep`]: `2.0.0`,
          },
        });

        await run(`install`);

        await run(`unplug`, `no-deps`, {
          cwd: ppath.join(path, `packages/foo` as PortablePath),
        });

        await expect(readManifest(path, {key: `dependenciesMeta`})).resolves.toEqual({
          [`no-deps@1.0.0`]: unplugged,
        });

        await run(`unplug`, `no-deps`, `--recursive`, `--all`, {
          cwd: ppath.join(path, `packages/foo` as PortablePath),
        });

        await expect(readManifest(path, {key: `dependenciesMeta`})).resolves.toEqual({
          [`no-deps@1.0.0`]: unplugged,
          [`no-deps@2.0.0`]: unplugged,
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
          locator: `@types/is-number@npm:1.0.0`,
          version: `1.0.0`,
        });
      }),
    );
  });
});
