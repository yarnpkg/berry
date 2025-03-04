import {xfs, ppath} from '@yarnpkg/fslib';

const {
  fs: {FsLinkType, determineLinkType},
} = require(`pkg-tests-core`);

const customStoreFolderName = `.customStore`;

describe(`Features`, () => {
  describe(`pnpmStoreLocation`, () => {
    test(
      `it should create the store at custom path and symlink all files to the custom store location`,
      makeTemporaryEnv(
        {
          dependencies: {[`no-deps`]: `1.0.0`},
        },
        {
          nodeLinker: `pnpm`,
          pnpmStoreFolder: customStoreFolderName,
          winLinkType: `symlinks`,
        },
        async ({path, run, source}) => {
          await run(`install`);

          // Ensure that the customized folder is created
          const absolutePnpmStorePath = ppath.join(path, customStoreFolderName);
          expect(xfs.existsSync(absolutePnpmStorePath)).toEqual(true);

          // Ensure that the default node_modules/.store folder is not created
          expect(xfs.existsSync(ppath.join(path, `node_modules`, `.store`))).toEqual(false);

          // Ensure that the installed package is a symbolic link
          const installedPackagePath = ppath.join(path, `node_modules`, `no-deps`);
          expect(await determineLinkType(installedPackagePath)).toEqual(FsLinkType.SYMBOLIC);

          // Ensure that the link target is a relative path
          const installedPackageLinkTarget = await xfs.readlinkPromise(installedPackagePath);
          expect(ppath.isAbsolute(installedPackageLinkTarget)).toBeFalsy();

          // Ensure that the resolved link target is within the customized pnpmStoreFolder.
          const resolvedPackageLinkTarget = ppath.join(ppath.dirname(installedPackagePath), installedPackageLinkTarget);
          expect(ppath.contains(absolutePnpmStorePath, resolvedPackageLinkTarget)).toBeTruthy();
        },
      ),
    );
  });
});
