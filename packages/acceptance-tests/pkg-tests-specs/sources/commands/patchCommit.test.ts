import {Filename, npath, ppath, xfs} from '@yarnpkg/fslib';

describe(`Commands`, () => {
  describe(`patch-commit`, () => {
    test(
      `it should generate a patch from a package folder`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        const {stdout} = await run(`patch`, `no-deps`, `--json`);
        const {path: updateFolderN} = JSON.parse(stdout);

        const updateFolder = npath.toPortablePath(updateFolderN);
        const updateFile = ppath.join(updateFolder, `index.js` as Filename);

        const fileSource = await xfs.readFilePromise(updateFile, `utf8`);
        const fileUser = fileSource.replace(`require(dep)`, `42`);
        await xfs.writeFilePromise(updateFile, fileUser);

        await expect(run(`patch-commit`, updateFolder)).resolves.toMatchSnapshot();
      }),
    );

    test(
      `it should save patches into a local folder if requested`,
      makeTemporaryEnv({
        dependencies: {
          [`one-fixed-dep`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        const {stdout} = await run(`patch`, `one-fixed-dep`, `--json`);
        const {path: updateFolderN} = JSON.parse(stdout);

        const updateFolder = npath.toPortablePath(updateFolderN);
        const updateFile = ppath.join(updateFolder, `index.js` as Filename);

        const fileSource = await xfs.readFilePromise(updateFile, `utf8`);
        const fileUser = fileSource.replace(`require(dep)`, `42`);
        await xfs.writeFilePromise(updateFile, fileUser);

        await run(`patch-commit`, `-s`, npath.fromPortablePath(updateFolder));
        await run(`install`);

        await expect(source(`require('one-fixed-dep')`)).resolves.toMatchObject({
          dependencies: {
            [`no-deps`]: 42,
          },
        });
      }),
    );

    test(
      `it should reference patches from the workspace dependencies when possible`,
      makeTemporaryEnv({
        dependencies: {
          [`one-fixed-dep`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        const {stdout} = await run(`patch`, `one-fixed-dep`, `--json`);
        const {path: updateFolderN} = JSON.parse(stdout);

        const updateFolder = npath.toPortablePath(updateFolderN);
        const updateFile = ppath.join(updateFolder, `index.js` as Filename);

        const fileSource = await xfs.readFilePromise(updateFile, `utf8`);
        const fileUser = fileSource.replace(`require(dep)`, `42`);
        await xfs.writeFilePromise(updateFile, fileUser);

        await run(`patch-commit`, `-s`, npath.fromPortablePath(updateFolder));

        const manifest = await xfs.readJsonPromise(ppath.join(path, Filename.manifest));

        expect(manifest.dependencies).toEqual({
          [`one-fixed-dep`]: `patch:one-fixed-dep@npm%3A1.0.0#~/.yarn/patches/one-fixed-dep-npm-1.0.0-b02516a4af.patch`,
        });

        expect(manifest).not.toHaveProperty(`resolutions`);
      }),
    );

    test(
      `it should reference patches using the 'resolutions' field when required`,
      makeTemporaryEnv({
        dependencies: {
          [`one-fixed-dep`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        const {stdout} = await run(`patch`, `no-deps`, `--json`);
        const {path: updateFolderN} = JSON.parse(stdout);

        const updateFolder = npath.toPortablePath(updateFolderN);
        const updateFile = ppath.join(updateFolder, `index.js` as Filename);

        const fileSource = await xfs.readFilePromise(updateFile, `utf8`);
        const fileUser = fileSource.replace(`require(dep)`, `42`);
        await xfs.writeFilePromise(updateFile, fileUser);

        await run(`patch-commit`, `-s`, npath.fromPortablePath(updateFolder));

        const manifest = await xfs.readJsonPromise(ppath.join(path, Filename.manifest));

        expect(manifest.dependencies).toEqual({
          [`one-fixed-dep`]: `1.0.0`,
        });

        expect(manifest.resolutions).toEqual({
          [`no-deps@npm:1.0.0`]: `patch:no-deps@npm%3A1.0.0#~/.yarn/patches/no-deps-npm-1.0.0-cf533b267a.patch`,
        });
      }),
    );

    test(
      `it should replace the patch when calling patch-commit again, not wrap it into another patch layer`,
      makeTemporaryEnv({
        dependencies: {
          [`one-fixed-dep`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        {
          const {stdout} = await run(`patch`, `one-fixed-dep`, `--json`);
          const {path: updateFolderN} = JSON.parse(stdout);

          const updateFolder = npath.toPortablePath(updateFolderN);
          const updateFile = ppath.join(updateFolder, `new.js` as Filename);

          const fileUser = `module.exports = 42;\n`;
          await xfs.writeFilePromise(updateFile, fileUser);

          await run(`patch-commit`, `-s`, npath.fromPortablePath(updateFolder));

          const manifest = await xfs.readJsonPromise(ppath.join(path, Filename.manifest));

          expect(manifest.dependencies).toEqual({
            [`one-fixed-dep`]: `patch:one-fixed-dep@npm%3A1.0.0#~/.yarn/patches/one-fixed-dep-npm-1.0.0-b02516a4af.patch`,
          });
        }

        {
          const {stdout} = await run(`patch`, `one-fixed-dep`, `--json`);
          const {path: updateFolderN} = JSON.parse(stdout);

          const updateFolder = npath.toPortablePath(updateFolderN);
          const updateFile = ppath.join(updateFolder, `new.js` as Filename);

          const fileUser = `module.exports = 21;\n`;
          await xfs.writeFilePromise(updateFile, fileUser);

          await run(`patch-commit`, `-s`, npath.fromPortablePath(updateFolder));

          const manifest = await xfs.readJsonPromise(ppath.join(path, Filename.manifest));

          expect(manifest.dependencies).toEqual({
            [`one-fixed-dep`]: `patch:one-fixed-dep@npm%3A1.0.0#~/.yarn/patches/one-fixed-dep-npm-1.0.0-b02516a4af.patch`,
          });
        }
      }),
    );

    test(
      `it should be able to patch virtual packages`,
      makeTemporaryEnv({
        dependencies: {
          [`peer-deps-lvl0`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        const {stdout} = await run(`patch`, `peer-deps-lvl1`, `--json`);
        const {path: updateFolderN} = JSON.parse(stdout);

        const updateFolder = npath.toPortablePath(updateFolderN);
        const updateFile = ppath.join(updateFolder, `index.js` as Filename);

        const fileSource = await xfs.readFilePromise(updateFile, `utf8`);
        const fileUser = fileSource.replace(`require(dep)`, `42`);
        await xfs.writeFilePromise(updateFile, fileUser);

        await run(`patch-commit`, `-s`, npath.fromPortablePath(updateFolder));

        const manifest = await xfs.readJsonPromise(ppath.join(path, Filename.manifest));

        expect(manifest.dependencies).toEqual({
          [`peer-deps-lvl0`]: `1.0.0`,
        });

        expect(manifest.resolutions).toEqual({
          [`peer-deps-lvl1@npm:1.0.0`]: `patch:peer-deps-lvl1@npm%3A1.0.0#~/.yarn/patches/peer-deps-lvl1-npm-1.0.0-894d37389e.patch`,
        });
      }),
    );
  });
});
