import {ppath, xfs}    from '@yarnpkg/fslib';
import {fs as fsUtils} from 'pkg-tests-core';
import {tests}         from 'pkg-tests-core';

describe(`Protocols`, () => {
  describe(`jsr:`, () => {
    test(
      `is should allow adding a package with "yarn add"`,
      makeTemporaryEnv(
        {},
        async ({path, run, source}) => {
          await xfs.writeFilePromise(ppath.join(path, `.yarnrc.yml`), JSON.stringify({
            [`npmScopes`]: {
              [`jsr`]: {
                [`npmRegistryServer`]: `${await tests.startPackageServer()}/registry/jsr`,
              },
            },
          }));

          await run(`add`, `jsr:no-deps-jsr`);

          await expect(source(`require('no-deps-jsr')`)).resolves.toMatchObject({
            name: `@jsr/no-deps-jsr`,
          });

          await expect(xfs.readJsonPromise(ppath.join(path, `package.json`))).resolves.toMatchObject({
            dependencies: {
              [`no-deps-jsr`]: `jsr:^1.0.0`,
            },
          });
        },
      ),
    );

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

    test(
      `it should replace the jsr registry with a npm registry during packing`,
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
          await run(`pack`);

          const tarballPath = ppath.join(path, `package.tgz`);
          const unpackedPath = ppath.join(path, `unpacked`);

          await xfs.mkdirPromise(unpackedPath);
          await fsUtils.unpackToDirectory(unpackedPath, tarballPath);

          const manifest = await xfs.readJsonPromise(ppath.join(unpackedPath, `package`, `package.json`));

          expect(manifest).toMatchObject({
            dependencies: {
              [`no-deps-jsr`]: `npm:@jsr/no-deps-jsr@1.0.0`,
            },
          });
        },
      ),
    );
  });
});
