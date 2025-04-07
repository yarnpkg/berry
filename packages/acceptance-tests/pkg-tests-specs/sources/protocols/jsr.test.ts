import {ppath, xfs} from '@yarnpkg/fslib';
import {tests}      from 'pkg-tests-core';

describe(`Protocols`, () => {
  describe(`jsr:`, () => {
    test(
      `it should allow installing a package from a jsr registry`,
      makeTemporaryEnv(
        {
          dependencies: {[`no-deps-jsr`]: `jsr:1.0.0`},
        },
        async ({path, run, source}) => {
          await xfs.writeFilePromise(ppath.join(path, `.yarnrc.yml`), JSON.stringify({
            [`npmScopes`]: {
              [`jsr`]: {
                [`npmRegistryServer`]: `${await tests.startPackageServer()}/registry/jsr`,
              },
            },
          }));

          await run(`install`);

          await expect(source(`require('no-deps-jsr')`)).resolves.toMatchObject({
            // The package name is prefixed with @jsr/ because that's what the registry returns
            name: `@jsr/no-deps-jsr`,
            version: `1.0.0`,
          });
        },
      ),
    );

    test(
      `it should allow renaming packages`,
      makeTemporaryEnv(
        {
          dependencies: {[`foo`]: `jsr:no-deps-jsr@1.0.0`},
        },
        async ({path, run, source}) => {
          await xfs.writeFilePromise(ppath.join(path, `.yarnrc.yml`), JSON.stringify({
            [`npmScopes`]: {
              [`jsr`]: {
                [`npmRegistryServer`]: `${await tests.startPackageServer()}/registry/jsr`,
              },
            },
          }));

          await run(`install`);

          await expect(source(`require('foo')`)).resolves.toMatchObject({
            name: `@jsr/no-deps-jsr`,
            version: `1.0.0`,
          });
        },
      ),
    );
  });
});
