import {xfs} from '@yarnpkg/fslib';

const {
  fs: {writeFile, writeJson},
} = require('pkg-tests-core');

// Here be dragons. The biggest and baddest tests, that just can't be described in a single line of summary. Because
// of this, they each must be clearly documented and explained.
//
// Because of their complexity, they generally have their own specific packages, which should NOT be renamed
// (some of these tests might rely on the package names being sorted in a certain way).

describe(`Dragon tests`, () => {
  test(
    `it should pass the dragon test 1`,
    makeTemporaryEnv(
      {
        dependencies: {
          [`dragon-test-1-d`]: `1.0.0`,
          [`dragon-test-1-e`]: `1.0.0`,
        },
      },
      async ({path, run, source}) => {
        // This test assumes the following:
        //
        // . -> D@1.0.0 -> C@1.0.0 -> B@1.0.0 -> A@1.0.0
        //   -> E@1.0.0 -> B@2.0.0
        //              -> C@1.0.0 -> B@1.0.0 -> A@1.0.0
        //
        // This setup has the following properties:
        //
        //   - we have a package that can be hoisted (dragon-test-1-a, aka A)
        //   - its parent can NOT be hoisted (dragon-test-1-b, aka B)
        //   - its grandparent can be hoisted (dragon-test-1-c, aka C)
        //   - the D package prevents E>C from being pruned from the tree at resolution
        //
        // In this case, the package that can be hoisted will be hoisted to the
        // top-level while we traverse the D branch, then B as well, then C as
        // well. We then crawl the E branch: A is merged with the top-level A
        // (so we merge their hoistedFrom fields), then B cannot be hoisted
        // because its version conflict with the direct dependency of E (so
        // its hoistedFrom field stays where it is), then C will be merged
        // with the top-level C we already had, and its whole dependency branch
        // will be removed from the tree (including the B direct dependency that
        // has not been hoisted).
        //
        // Because of this, we end up having a hoistedFrom entry in A that
        // references E>C>B>A. When we try to link this to its parent (E>C>B), we
        // might then have a problem, because E>C>B doesn't exist anymore in the
        // tree (we removed it when we hoisted C).
        //
        // This test simply makes sure that this edge case doesn't crash the install.

        await run(`install`);
      },
    ),
  );

  test(
    `it should pass the dragon test 2`,
    makeTemporaryEnv(
      {
        private: true,
        workspaces: [`dragon-test-2-a`, `dragon-test-2-b`],
        dependencies: {
          [`dragon-test-2-a`]: `1.0.0`,
        },
      },
      async ({path, run, source}) => {
        // This test assumes the following:
        //
        // . -> A@workspace -> B@workspace -> no-deps@* (peer dep)
        //                  -> no-deps@1.0.0
        //
        // In this situation, the implementation might register the workspaces one by
        // one, going through all their dependencies before moving to the next one.
        // Because the workspace B is also a dependency of the workspace A, it will be
        // traversed a first time as a dependency of A, and then a second time as a
        // workspace.
        //
        // A problem is when B also has peer dependencies, like in the setup described
        // above. In this case, the Yarn implementation of PnP needs to generate a virtual
        // package for B (in order to deambiguate the dependencies), and register it while
        // processing A. Then later, when iterating over B, it is possible that the
        // workspace registration overwrites the previously registered virtual dependency,
        // making it unavailable whilst still being referenced in the dependencies of A.
        //
        // This test ensures that A can always require B.

        await writeJson(`${path}/dragon-test-2-a/package.json`, {
          name: `dragon-test-2-a`,
          version: `1.0.0`,
          dependencies: {
            [`dragon-test-2-b`]: `1.0.0`,
            [`no-deps`]: `1.0.0`,
          },
        });

        await writeJson(`${path}/dragon-test-2-b/package.json`, {
          name: `dragon-test-2-b`,
          version: `1.0.0`,
          peerDependencies: {
            [`no-deps`]: `*`,
          },
        });

        await writeFile(`${path}/dragon-test-2-a/index.js`, `module.exports = require('dragon-test-2-b')`);
        await writeFile(`${path}/dragon-test-2-b/index.js`, `module.exports = require('no-deps')`);

        await run(`install`);

        await expect(source(`require("dragon-test-2-a")`)).resolves.toMatchObject({
          name: `no-deps`,
          version: `1.0.0`,
        });
      },
    ),
  );

  test(
    `it should pass the dragon test 3`,
    makeTemporaryEnv(
      {
        dependencies: {
          [`dragon-test-3-a`]: `1.0.0`,
        },
      },
      async ({path, run, source}) => {
        // This test assumes the following:
        //
        // . -> A -> B -> A@* (peer dep)
        //        -> C@* (peer dep)
        //
        // In this situation, because A has a peer dependency (on C), it must be instantiated
        // once for each time it is found in the dependency tree. The problem is that since one
        // of its dependencies (B) has itself a peer dependency on A, we can reach a state where
        // the package manager will make an infinite loop - it will instantiate A, then B, then
        // A, then B, etc, until it eventually runs out of memory.

        await run(`install`);
      },
    ),
  );

  test(
    `it should pass the dragon test 4`,
    makeTemporaryEnv(
      {
        private: true,
        workspaces: [
          `my-workspace`,
        ],
      },
      async ({path, run, source}) => {
        // This test assume that we have a workspace that has a dependency listed in both its
        // peer dependencies and its dev dependencies, and that it itself has a peer
        // depencency. In those circumstances, we've had issues where the peer dependency
        // wasn't being properly resolved.

        await xfs.mkdirpPromise(`${path}/my-workspace`);
        await xfs.writeJsonPromise(`${path}/my-workspace/package.json`, {
          name: `my-workspace`,
          peerDependencies: {
            [`no-deps`]: `*`,
            [`peer-deps`]: `*`,
          },
          devDependencies: {
            [`no-deps`]: `1.0.0`,
            [`peer-deps`]: `1.0.0`,
          },
        });

        await run(`install`);

        await expect(source(`require('peer-deps')`, {
          cwd: `${path}/my-workspace`,
        })).resolves.toMatchObject({
          name: `peer-deps`,
          version: `1.0.0`,
          peerDependencies: {
            [`no-deps`]: {
              name: `no-deps`,
              version: `1.0.0`,
            },
          },
        });
      },
    ),
  );

  test(
    `it should pass the dragon test 5`,
    makeTemporaryEnv(
      {
        private: true,
        workspaces: [
          `packages/*`,
        ],
      },
      async ({path, run, source}) => {
        // This test is related to the way Yarn is resolving peer dependencies
        // into virtual packages (check our documentation for more details). In
        // short, we create copies of packages when they have peer dependencies,
        // and update their immediate parents to instead reference the copy.
        //
        // Since parents have been copied themselves if there's a possibility
        // they would resolve to different versions (because it only happens
        // when they have peer dependencies themselves) the patch operation is
        // safe. There's one catch though: workspaces aren't traversed this way
        // in our implementation, so they aren't copied, and the dependency
        // replacements may end up being mirrored in the other unrelated
        // instances of the same package.
        //
        // To reproduce this situation, we have:
        //
        // . -> A -> X -> Y (peer deps)
        //        -> Y
        //        -> Z (peer deps)
        //
        //   -> B -> A
        //        -> Z
        //
        // This setup has the following characteristics:
        //
        //   - A and B are both workspaces, and X,Y,Z are packages we don't
        //     care about too much (except that X has a peer dep on Y).
        //
        //   - Since A has a peer dependency, two different instances of it
        //     exist: one as an independant workspace, and another as a
        //     dependency of B. This is critical because otherwise Yarn will
        //     just skip the second traversal of A (since we know its
        //     dependencies have already been virtualized).
        //
        // This causes the bug to appear: A gets traversed, we see that it
        // depends on X which has a peer dependency, so we virtualize X and
        // modify A to point to this new package instead of the original X.
        // Then once we traverse B we check the dependencies of A, but by
        // this time they have already been modified, leading to a boggus
        // install.

        await xfs.mkdirpPromise(`${path}/packages/a`);
        await xfs.writeJsonPromise(`${path}/packages/a/package.json`, {
          name: `a`,
          peerDependencies: {
            [`various-requires`]: `*`,
          },
          devDependencies: {
            [`no-deps`]: `1.0.0`,
            [`peer-deps`]: `1.0.0`,
          },
        });

        await xfs.mkdirpPromise(`${path}/packages/b`);
        await xfs.writeJsonPromise(`${path}/packages/b/package.json`, {
          name: `b`,
          devDependencies: {
            [`a`]: `workspace:*`,
            [`various-requires`]: `1.0.0`,
          },
        });

        await run(`install`);
      },
    ),
  );

  test(
    `it should pass the dragon test 6`,
    makeTemporaryEnv(
      {
        private: true,
        workspaces: [
          `packages/*`,
        ],
      },
      async ({path, run, source}) => {
        // Virtual packages are deduplicated, so that if multiple ones share
        // the same set of dependencies they end up being unified into one.
        // In order to do this, we track which package depends on which one
        // so that we can properly update the dependents during unification.
        //
        // One problem that may arise is when a package with peer dependencies
        // is used twice in the dependency tree, and itself depends on a
        // package that lists peer dependencies. In this situation, the
        // package may be removed from the dependency tree during unification,
        // then its dependency gets unified too but the registered dependent
        // doesn't exist anymore.

        await xfs.mkdirpPromise(`${path}/packages/a`);
        await xfs.writeJsonPromise(`${path}/packages/a/package.json`, {
          name: `a`,
          dependencies: {
            [`z`]: `workspace:*`,
          },
        });

        await xfs.mkdirpPromise(`${path}/packages/b`);
        await xfs.writeJsonPromise(`${path}/packages/b/package.json`, {
          name: `b`,
          dependencies: {
            [`u`]: `workspace:*`,
            [`v`]: `workspace:*`,
          },
        });

        await xfs.mkdirpPromise(`${path}/packages/c`);
        await xfs.writeJsonPromise(`${path}/packages/c/package.json`, {
          name: `c`,
          dependencies: {
            [`u`]: `workspace:*`,
            [`v`]: `workspace:*`,
            [`y`]: `workspace:*`,
            [`z`]: `workspace:*`,
          },
        });

        await xfs.mkdirpPromise(`${path}/packages/u`);
        await xfs.writeJsonPromise(`${path}/packages/u/package.json`, {
          name: `u`,
        });

        await xfs.mkdirpPromise(`${path}/packages/v`);
        await xfs.writeJsonPromise(`${path}/packages/v/package.json`, {
          name: `v`,
          peerDependencies: {
            [`u`]: `*`,
          },
        });

        await xfs.mkdirpPromise(`${path}/packages/y`);
        await xfs.writeJsonPromise(`${path}/packages/y/package.json`, {
          name: `y`,
          peerDependencies: {
            [`v`]: `*`,
          },
        });

        await xfs.mkdirpPromise(`${path}/packages/z`);
        await xfs.writeJsonPromise(`${path}/packages/z/package.json`, {
          name: `z`,
          dependencies: {
            [`y`]: `workspace:*`,
          },
          peerDependencies: {
            [`v`]: `*`,
          },
        });

        await run(`install`);
      },
    ),
  );
});
