import {PortablePath, ppath, xfs} from '@yarnpkg/fslib';

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
  });
});
