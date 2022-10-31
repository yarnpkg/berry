import {WindowsLinkType}                 from '@yarnpkg/core';
import {PortablePath, ppath, npath, xfs} from '@yarnpkg/fslib';

const {
  fs: {FsLinkType, determineLinkType},
  tests: {testIf},
} = require(`pkg-tests-core`);

describe(`Features`, () => {
  describe(`Pnpm Mode `, () => {
    test(
      `it shouldn't crash if we recursively traverse a node_modules`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps`]: `1.0.0`,
        },
      }, {
        nodeLinker: `pnpm`,
      }, async ({path, run, source}) => {
        await run(`install`);

        let iterationCount = 0;

        const getRecursiveDirectoryListing = async (p: PortablePath) => {
          if (iterationCount++ > 500)
            throw new Error(`Possible infinite recursion detected`);

          for (const entry of await xfs.readdirPromise(p)) {
            const entryPath = ppath.join(p, entry);
            const stat = await xfs.statPromise(entryPath);

            if (stat.isDirectory()) {
              await getRecursiveDirectoryListing(entryPath);
            }
          }
        };

        await getRecursiveDirectoryListing(path);
      }),
    );

    testIf(() => process.platform === `win32`,
      `'winLinkType: symlinks' on Windows should use symlinks in node_modules directories`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`no-deps`]: `1.0.0`,
          },
        },
        {
          nodeLinker: `pnpm`,
          winLinkType: WindowsLinkType.SYMLINKS,
        },
        async ({path, run}) => {
          await run(`install`);

          const packageLinkPath = npath.toPortablePath(`${path}/node_modules/no-deps`);
          expect(await determineLinkType(packageLinkPath)).toEqual(FsLinkType.SYMBOLIC);
          expect(ppath.isAbsolute(await xfs.readlinkPromise(npath.toPortablePath(packageLinkPath)))).toBeFalsy();
        },
      ),
    );

    testIf(() => process.platform === `win32`,
      `'winLinkType: junctions' on Windows should use junctions in node_modules directories`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`no-deps`]: `1.0.0`,
          },
        },
        {
          nodeLinker: `pnpm`,
          winLinkType: WindowsLinkType.JUNCTIONS,
        },
        async ({path, run}) => {
          await run(`install`);
          const packageLinkPath = npath.toPortablePath(`${path}/node_modules/no-deps`);
          expect(await determineLinkType(packageLinkPath)).toEqual(FsLinkType.NTFS_JUNCTION);
          expect(ppath.isAbsolute(await xfs.readlinkPromise(packageLinkPath))).toBeTruthy();
        },
      ),
    );

    testIf(() => process.platform !== `win32`,
      `'winLinkType: junctions' not-on Windows should use symlinks in node_modules directories`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`no-deps`]: `1.0.0`,
          },
        },
        {
          nodeLinker: `pnpm`,
          winLinkType: WindowsLinkType.JUNCTIONS,
        },
        async ({path, run}) => {
          await run(`install`);
          const packageLinkPath = npath.toPortablePath(`${path}/node_modules/no-deps`);
          const packageLinkStat = await xfs.lstatPromise(packageLinkPath);

          expect(ppath.isAbsolute(await xfs.readlinkPromise(packageLinkPath))).toBeFalsy();
          expect(packageLinkStat.isSymbolicLink()).toBeTruthy();
        },
      ),
    );

    testIf(() => process.platform !== `win32`,
      `'winLinkType: symlinks' not-on Windows should use symlinks in node_modules directories`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`no-deps`]: `1.0.0`,
          },
        },
        {
          nodeLinker: `pnpm`,
          winLinkType: WindowsLinkType.SYMLINKS,
        },
        async ({path, run}) => {
          await run(`install`);

          const packageLinkPath = npath.toPortablePath(`${path}/node_modules/no-deps`);
          const packageLinkStat = await xfs.lstatPromise(packageLinkPath);

          expect(ppath.isAbsolute(await xfs.readlinkPromise(packageLinkPath))).toBeFalsy();
          expect(packageLinkStat.isSymbolicLink()).toBeTruthy();
        },
      ),
    );
  });
});
