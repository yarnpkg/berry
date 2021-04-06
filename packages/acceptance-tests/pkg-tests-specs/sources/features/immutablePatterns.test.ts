import {xfs, ppath, Filename} from '@yarnpkg/fslib';

describe(`Features`, () => {
  describe(`immutablePatterns`, () => {
    it(`shouldn't have an effect unless --immutable is set`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`no-deps`]: `1.0.0`,
          },
        },
        async ({path, run, source}) => {
          await xfs.writeFilePromise(ppath.join(path, Filename.rc), `immutablePatterns: [.pnp.cjs]`);

          await run(`install`);

          const lockfile = await xfs.readFilePromise(ppath.join(path, Filename.lockfile));
          await xfs.writeJsonPromise(ppath.join(path, Filename.manifest), {
            dependencies: {
              [`no-deps`]: `2.0.0`,
            },
          });

          await run(`install`);

          await xfs.writeFilePromise(ppath.join(path, Filename.lockfile), lockfile);
          await xfs.writeJsonPromise(ppath.join(path, Filename.manifest), {
            dependencies: {
              [`no-deps`]: `1.0.0`,
            },
          });

          await run(`install`);
        },
      )
    );

    it(`shouldn't allow specific paths to be created when the immutable flag is used`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`no-deps`]: `1.0.0`,
          },
        },
        async ({path, run, source}) => {
          await xfs.writeFilePromise(ppath.join(path, Filename.rc), `immutablePatterns: [.pnp.cjs]`);

          await run(`install`);

          await xfs.unlinkPromise(ppath.join(path, Filename.pnpCjs));

          await expect(run(`install`, `--immutable`)).rejects.toThrow(/The checksum for \.pnp\.cjs has been modified by this install/);
        },
      )
    );

    it(`shouldn't allow specific paths to be updated when the immutable flag is used`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`no-deps`]: `1.0.0`,
          },
        },
        async ({path, run, source}) => {
          await xfs.writeFilePromise(ppath.join(path, Filename.rc), `immutablePatterns: [.pnp.cjs]`);

          await run(`install`);

          const lockfile = await xfs.readFilePromise(ppath.join(path, Filename.lockfile));
          await xfs.writeJsonPromise(ppath.join(path, Filename.manifest), {
            dependencies: {
              [`no-deps`]: `2.0.0`,
            },
          });

          await run(`install`);

          await xfs.writeFilePromise(ppath.join(path, Filename.lockfile), lockfile);
          await xfs.writeJsonPromise(ppath.join(path, Filename.manifest), {
            dependencies: {
              [`no-deps`]: `1.0.0`,
            },
          });

          await expect(run(`install`, `--immutable`)).rejects.toThrow(/The checksum for \.pnp\.cjs has been modified by this install/);
        },
      )
    );

    it(`should detect changes within folders`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`no-deps`]: `1.0.0`,
          },
        },
        {
          nodeLinker: `node-modules`,
        },
        async ({path, run, source}) => {
          await xfs.writeFilePromise(ppath.join(path, Filename.rc), `immutablePatterns: ["**/node_modules"]`);

          await run(`install`);

          const lockfile = await xfs.readFilePromise(ppath.join(path, Filename.lockfile));
          await xfs.writeJsonPromise(ppath.join(path, Filename.manifest), {
            dependencies: {
              [`no-deps`]: `2.0.0`,
            },
          });

          await run(`install`);

          await xfs.writeFilePromise(ppath.join(path, Filename.lockfile), lockfile);
          await xfs.writeJsonPromise(ppath.join(path, Filename.manifest), {
            dependencies: {
              [`no-deps`]: `1.0.0`,
            },
          });

          await expect(run(`install`, `--immutable`)).rejects.toThrow(/The checksum for \*\*\/node_modules has been modified by this install/);
        },
      )
    );

    it(`should prevent reformatting of manifests when so configured`,
      makeTemporaryEnv(
        {
        },
        {
          nodeLinker: `node-modules`,
          immutablePatterns: [`package.json`],
        },
        async ({path, run, source}) => {
          // create lockfile
          await run(`install`);
          // empty dependencies block will be deleted by persist()
          await xfs.writeJsonPromise(ppath.join(path, Filename.manifest), {dependencies: {}});
          await expect(run(`install`, `--immutable`)).rejects.toThrow(/The checksum for package.json has been modified by this install/);
        },
      )
    );

    it(`shouldn't fail when a folder didn't change`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`no-deps`]: `1.0.0`,
          },
        },
        {
          nodeLinker: `node-modules`,
        },
        async ({path, run, source}) => {
          await xfs.writeFilePromise(ppath.join(path, Filename.rc), `immutablePatterns: ["**/node_modules"]`);

          await run(`install`);
          await run(`install`, `--immutable`);
        },
      )
    );
  });
});
