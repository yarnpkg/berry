import {Filename, PortablePath, ppath, xfs} from '@yarnpkg/fslib';

describe(`Commands`, () => {
  describe(`init`, () => {
    test(
      `it should create a new package.json in the local directory if it doesn't exist`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await xfs.mktempPromise(async tmpDir => {
          const pkgDir = ppath.join(tmpDir, `my-package` as PortablePath);
          await xfs.mkdirpPromise(pkgDir);

          await run(`init`, {
            cwd: pkgDir,
          });

          await expect(xfs.readJsonPromise(ppath.join(pkgDir, Filename.manifest))).resolves.toMatchObject({
            name: `my-package`,
          });
        });
      }),
    );

    test(
      `it should create a new package.json in the specified directory if it doesn't exist`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await xfs.mktempPromise(async tmpDir => {
          const pkgDir = ppath.join(tmpDir, `my-package` as PortablePath);
          await xfs.mkdirpPromise(pkgDir);

          await run(`./my-package`, `init`, {
            cwd: tmpDir,
          });

          await expect(xfs.readJsonPromise(ppath.join(pkgDir, Filename.manifest))).resolves.toMatchObject({
            name: `my-package`,
          });
        });
      }),
    );

    test(
      `it should create a new package.json in the specified directory even if said directory doesn't exist`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await xfs.mktempPromise(async tmpDir => {
          const pkgDir = ppath.join(tmpDir, `my-package` as PortablePath);

          await run(`./my-package`, `init`, {
            cwd: tmpDir,
          });

          await expect(xfs.readJsonPromise(ppath.join(pkgDir, Filename.manifest))).resolves.toMatchObject({
            name: `my-package`,
          });
        });
      }),
    );

    test(
      `it should copy the currently running bundle when using --install`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await xfs.mktempPromise(async tmpDir => {
          const pkgDir = ppath.join(tmpDir, `my-package` as PortablePath);
          await xfs.mkdirpPromise(pkgDir);

          await run(`init`, `--install=self`, {
            cwd: pkgDir,
          });

          await expect(xfs.existsPromise(ppath.join(pkgDir, `.yarn/releases` as PortablePath))).resolves.toEqual(true);
        });
      }),
    );
  });
});
