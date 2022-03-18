import {Filename, npath, ppath, xfs} from '@yarnpkg/fslib';

describe(`Commands`, () => {
  describe(`patch`, () => {
    test(
      `it should restart the patch from scratch on subsequent patches by default`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        const notFound = {
          externalException: {
            code: `MODULE_NOT_FOUND`,
          },
        };

        await expect(source(`require('no-deps/foo')`)).rejects.toMatchObject(notFound);
        await expect(source(`require('no-deps/bar')`)).rejects.toMatchObject(notFound);

        {
          const {stdout} = await run(`patch`, `no-deps`, `--json`);
          const {path: updateFolderN} = JSON.parse(stdout);

          const updateFolder = npath.toPortablePath(updateFolderN);
          const updateFile = ppath.join(updateFolder, `foo.js` as Filename);

          const fileUser = `module.exports = 'foo';\n`;
          await xfs.writeFilePromise(updateFile, fileUser);

          await run(`patch-commit`, `-s`, npath.fromPortablePath(updateFolder));
          await run(`install`);

          await expect(source(`require('no-deps/foo')`)).resolves.toEqual(`foo`);
          await expect(source(`require('no-deps/bar')`)).rejects.toMatchObject(notFound);
        }

        {
          const {stdout} = await run(`patch`, `no-deps`, `--json`);
          const {path: updateFolderN} = JSON.parse(stdout);

          const updateFolder = npath.toPortablePath(updateFolderN);
          const updateFile = ppath.join(updateFolder, `bar.js` as Filename);

          const fileUser = `module.exports = 'bar';\n`;
          await xfs.writeFilePromise(updateFile, fileUser);

          await run(`patch-commit`, `-s`, npath.fromPortablePath(updateFolder));
          await run(`install`);

          await expect(source(`require('no-deps/foo')`)).rejects.toMatchObject(notFound);
          await expect(source(`require('no-deps/bar')`)).resolves.toEqual(`bar`);
        }
      }),
    );

    test(
      `it should augment current patches when using the -u flag`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        const notFound = {
          externalException: {
            code: `MODULE_NOT_FOUND`,
          },
        };

        await expect(source(`require('no-deps/foo')`)).rejects.toMatchObject(notFound);
        await expect(source(`require('no-deps/bar')`)).rejects.toMatchObject(notFound);

        {
          const {stdout} = await run(`patch`, `no-deps`, `--json`);
          const {path: updateFolderN} = JSON.parse(stdout);

          const updateFolder = npath.toPortablePath(updateFolderN);
          const updateFile = ppath.join(updateFolder, `foo.js` as Filename);

          const fileUser = `module.exports = 'foo';\n`;
          await xfs.writeFilePromise(updateFile, fileUser);

          await run(`patch-commit`, `-s`, npath.fromPortablePath(updateFolder));
          await run(`install`);

          await expect(source(`require('no-deps/foo')`)).resolves.toEqual(`foo`);
          await expect(source(`require('no-deps/bar')`)).rejects.toMatchObject(notFound);
        }

        {
          const {stdout} = await run(`patch`, `no-deps`, `-u`, `--json`);
          const {path: updateFolderN} = JSON.parse(stdout);

          const updateFolder = npath.toPortablePath(updateFolderN);
          const updateFile = ppath.join(updateFolder, `bar.js` as Filename);

          const fileUser = `module.exports = 'bar';\n`;
          await xfs.writeFilePromise(updateFile, fileUser);

          await run(`patch-commit`, `-s`, npath.fromPortablePath(updateFolder));
          await run(`install`);

          await expect(source(`require('no-deps/foo')`)).resolves.toEqual(`foo`);
          await expect(source(`require('no-deps/bar')`)).resolves.toEqual(`bar`);
        }
      }),
    );
  });
});
