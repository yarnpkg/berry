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
          await xfs.writeFilePromise(ppath.join(path, Filename.rc), `immutablePatterns: [.pnp.js]`);

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
          await xfs.writeFilePromise(ppath.join(path, Filename.rc), `immutablePatterns: [.pnp.js]`);

          await run(`install`);

          await xfs.unlinkPromise(ppath.join(path, Filename.pnpJs));

          await expect(run(`install`, `--immutable`)).rejects.toThrow(/The checksum for .pnp.js has been modified by this install/);
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
          await xfs.writeFilePromise(ppath.join(path, Filename.rc), `immutablePatterns: [.pnp.js]`);

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

          await expect(run(`install`, `--immutable`)).rejects.toThrow(/The checksum for .pnp.js has been modified by this install/);
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
  });
});
