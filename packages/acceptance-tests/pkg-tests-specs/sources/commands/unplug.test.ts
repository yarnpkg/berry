import {xfs, ppath, PortablePath, Filename} from '@yarnpkg/fslib';
import {yarn}                               from 'pkg-tests-core';

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
      `it should be able to unplug packages with peer dependencies`,
      makeTemporaryEnv({
        dependencies: {
          [`peer-deps`]: `npm:peer-deps@1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        await run(`unplug`, `peer-deps`);

        await expect(readManifest(path, {key: `dependenciesMeta`})).resolves.toEqual({
          [`peer-deps@1.0.0`]: unplugged,
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

    test(
      `it should not use an outdated install state`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps`]: `^1.0.0`,
        },
      }, async ({path, run, source}) => {
        const lockfilePath = ppath.join(path, Filename.lockfile);

        // Lock the resolution to a version that isn't the latest to
        // check that the descriptor isn't unlocked during the unplug
        await run(`install`);
        await run(`set`, `resolution`, `no-deps@npm:^1.0.0`, `npm:1.0.0`);

        // Sanity check
        await expect(xfs.readFilePromise(lockfilePath, `utf8`)).resolves.toContain(`resolution: "no-deps@npm:1.0.0"`);

        // Simulate switching to a branch where the version is different and back again
        await xfs.copyFilePromise(lockfilePath, ppath.join(path, `original.lock` as Filename));
        await run(`up`, `no-deps`, `-R`);
        await expect(xfs.readFilePromise(lockfilePath, `utf8`)).resolves.toContain(`resolution: "no-deps@npm:1.1.0"`);
        await xfs.copyFilePromise(ppath.join(path, `original.lock` as Filename), lockfilePath);

        // If a stale install state was used this will either fail or unlock the descriptor
        await run(`unplug`, `no-deps`);

        await expect(xfs.readFilePromise(lockfilePath, `utf8`)).resolves.toContain(`resolution: "no-deps@npm:1.0.0"`);
      }),
    );
  });
});
