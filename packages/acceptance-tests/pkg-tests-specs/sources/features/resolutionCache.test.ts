import {Filename, ppath, xfs} from '@yarnpkg/fslib';
import {tests}                from 'pkg-tests-core';

describe(`Features`, () => {
  describe(`Resolution cache`, () => {
    test(
      `it should use a cache metadata when resolving fixed versions`,
      makeTemporaryEnv({}, {
        enableGlobalCache: false,
      }, async ({path, run, source}) => {
        await run(`add`, `no-deps@2.0.0`);

        await xfs.removePromise(ppath.join(path, Filename.lockfile));

        // We now hide any version other than 1.0.0 from the registry. If the
        // install passes, it means that Yarn read the metadata from the cache rather
        // than the registry, as we wanted.

        await tests.setPackageWhitelist(new Map([
          [`no-deps`, new Set([`1.0.0`])],
        ]), async () => {
          await run(`install`);
        });
      }),
    );

    test(
      `it should properly separate the disk metadata cache from the network metadata cache`,
      makeTemporaryEnv({}, {
        enableGlobalCache: false,
      }, async ({path, run, source}) => {
        await tests.setPackageWhitelist(new Map([
          [`no-deps`, new Set([`1.0.0`])],
        ]), async () => {
          await run(`add`, `no-deps@1.0.0`);
        });

        await xfs.removePromise(ppath.join(path, Filename.lockfile));

        // At this point, no-deps has been added into the metadata cache, but only
        // with the 1.0.0 version. The metadata cache isn't aware of other versions.

        // Now, we need a way to force the resolution cache to be used before resolving
        // a version that it isn't aware of. To that end, we create a package.json with
        // a dependency on one-fixed-dep@2, and we run 'yarn add no-dep@1.0.0'. This
        // ensure that Yarn will run getCandidate on no-deps@1.0.0 first (because it's
        // required before adding it to the package.json), and no-deps@2.0.0 later.

        await xfs.writeFilePromise(ppath.join(path, Filename.manifest), JSON.stringify({
          dependencies: {
            [`one-fixed-dep`]: `2.0.0`,
          },
        }));

        await run(`add`, `no-deps@1.0.0`);
      }),
    );
  });
});
