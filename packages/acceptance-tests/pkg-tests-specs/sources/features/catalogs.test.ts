import {PortablePath, xfs}   from '@yarnpkg/fslib';
import {yarn, fs as fsUtils} from 'pkg-tests-core';

describe(`Features`, () => {
  describe(`Catalogs`, () => {
    test(
      `it should resolve dependencies from the default catalog during install`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`no-deps`]: `catalog:`,
          },
        },
        async ({path, run, source}) => {
          await yarn.writeConfiguration(path, {
            catalog: {
              [`no-deps`]: `2.0.0`,
            },
          });

          await run(`install`);

          await expect(source(`require('no-deps')`)).resolves.toMatchObject({
            name: `no-deps`,
            version: `2.0.0`,
          });
        },
      ),
    );

    test(
      `it should resolve dependencies from named catalogs during install`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`no-deps`]: `catalog:react18`,
          },
        },
        async ({path, run, source}) => {
          await yarn.writeConfiguration(path, {
            catalogs: {
              react18: {
                [`no-deps`]: `2.0.0`,
              },
            },
          });

          await run(`install`);

          await expect(source(`require('no-deps')`)).resolves.toMatchObject({
            name: `no-deps`,
            version: `2.0.0`,
          });
        },
      ),
    );

    test(
      `it should resolve scoped package dependencies from catalogs`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`@scoped/create-test-app`]: `catalog:`,
          },
        },
        async ({path, run, source}) => {
          await yarn.writeConfiguration(path, {
            catalog: {
              [`@scoped/create-test-app`]: `1.0.0`,
            },
          });

          await run(`install`);

          // Verify that the scoped package was resolved from catalog
          const lockfile = await xfs.readFilePromise(`${path}/yarn.lock` as PortablePath, `utf8`);
          expect(lockfile).toMatch(/@scoped\/create-test-app@npm:1\.0\.0/);
        },
      ),
    );

    test(
      `it should support multiple catalog entries in the same project`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`no-deps`]: `catalog:`,
            [`one-fixed-dep`]: `catalog:react18`,
          },
        },
        async ({path, run, source}) => {
          await yarn.writeConfiguration(path, {
            catalog: {
              [`no-deps`]: `2.0.0`,
            },
            catalogs: {
              react18: {
                [`one-fixed-dep`]: `1.0.0`,
              },
            },
          });

          await run(`install`);

          await expect(source(`require('no-deps')`)).resolves.toMatchObject({
            name: `no-deps`,
            version: `2.0.0`,
          });

          await expect(source(`require('one-fixed-dep')`)).resolves.toMatchObject({
            name: `one-fixed-dep`,
            version: `1.0.0`,
          });
        },
      ),
    );

    test(
      `it should work with different dependency types (devDependencies, peerDependencies)`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`one-fixed-dep`]: `catalog:tools`,
          },
          devDependencies: {
            [`no-deps`]: `catalog:`,
          },
        },
        async ({path, run}) => {
          await yarn.writeConfiguration(path, {
            catalog: {
              [`no-deps`]: `2.0.0`,
            },
            catalogs: {
              tools: {
                [`one-fixed-dep`]: `1.0.0`,
              },
            },
          });

          await run(`install`);

          // Check that the lockfile contains the resolved versions
          const lockfile = await xfs.readFilePromise(`${path}/yarn.lock` as PortablePath, `utf8`);
          expect(lockfile).toMatch(/no-deps@npm:2\.0\.0/);
          expect(lockfile).toMatch(/one-fixed-dep@npm:1\.0\.0/);
        },
      ),
    );

    test(
      `it should replace catalog references with actual versions during pack`,
      makeTemporaryEnv(
        {
          name: `my-package`,
          version: `1.0.0`,
          dependencies: {
            [`no-deps`]: `catalog:`,
          },
          devDependencies: {
            [`one-fixed-dep`]: `catalog:dev`,
          },
        },
        async ({path, run}) => {
          await yarn.writeConfiguration(path, {
            catalog: {
              [`no-deps`]: `^2.0.0`,
            },
            catalogs: {
              dev: {
                [`one-fixed-dep`]: `~1.0.0`,
              },
            },
          });

          await run(`install`);
          await run(`pack`);

          // Unpack the tarball and check the package.json content
          await fsUtils.unpackToDirectory(path, `${path}/package.tgz` as PortablePath);

          const packedManifest = await xfs.readJsonPromise(`${path}/package/package.json` as PortablePath);

          expect(packedManifest.dependencies[`no-deps`]).toBe(`^2.0.0`);
          expect(packedManifest.devDependencies[`one-fixed-dep`]).toBe(`~1.0.0`);
        },
      ),
    );

    test(
      `it should handle complex version ranges in catalogs`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`no-deps`]: `catalog:`,
          },
        },
        async ({path, run, source}) => {
          await yarn.writeConfiguration(path, {
            catalog: {
              [`no-deps`]: `>=1.0.0 <3.0.0`,
            },
          });

          await run(`install`);

          // Should resolve to the highest compatible version (2.0.0)
          await expect(source(`require('no-deps')`)).resolves.toMatchObject({
            name: `no-deps`,
            version: `2.0.0`,
          });
        },
      ),
    );

    test(
      `it should throw an error when catalog is not found`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`no-deps`]: `catalog:nonexistent`,
          },
        },
        async ({path, run}) => {
          await yarn.writeConfiguration(path, {
            catalog: {
              [`no-deps`]: `2.0.0`,
            },
          });

          await expect(run(`install`)).rejects.toThrow();
        },
      ),
    );

    test(
      `it should throw an error when catalog entry is not found`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`nonexistent-package`]: `catalog:`,
          },
        },
        async ({path, run}) => {
          await yarn.writeConfiguration(path, {
            catalog: {
              [`no-deps`]: `2.0.0`,
            },
          });

          await expect(run(`install`)).rejects.toThrow();
        },
      ),
    );

    test(
      `it should throw an error when default catalog is empty`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`no-deps`]: `catalog:`,
          },
        },
        async ({path, run}) => {
          await yarn.writeConfiguration(path, {
            catalog: {},
          });

          await expect(run(`install`)).rejects.toThrow();
        },
      ),
    );

    test(
      `it should work with file: protocol ranges in catalogs`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`my-local-package`]: `catalog:`,
          },
        },
        async ({path, run}) => {
          // Create a local package
          await xfs.mkdirPromise(`${path}/local-package` as PortablePath, {recursive: true});
          await xfs.writeJsonPromise(`${path}/local-package/package.json` as PortablePath, {
            name: `my-local-package`,
            version: `1.0.0`,
          });

          await yarn.writeConfiguration(path, {
            catalog: {
              [`my-local-package`]: `file:./local-package`,
            },
          });

          await run(`install`);

          // Verify that the local package was installed
          const lockfile = await xfs.readFilePromise(`${path}/yarn.lock` as PortablePath, `utf8`);
          expect(lockfile).toMatch(/my-local-package@file:\.\/local-package/);
        },
      ),
    );

    test(
      `it should work in workspace environments`,
      makeTemporaryMonorepoEnv(
        {
          workspaces: [`packages/*`],
        },
        {
          packages: {},
        },
        async ({path, run}) => {
          // Create workspace package
          await xfs.mkdirPromise(`${path}/packages/workspace-a` as PortablePath, {recursive: true});
          await xfs.writeJsonPromise(`${path}/packages/workspace-a/package.json` as PortablePath, {
            name: `workspace-a`,
            version: `1.0.0`,
            dependencies: {
              [`no-deps`]: `catalog:`,
            },
          });

          await yarn.writeConfiguration(path, {
            catalog: {
              [`no-deps`]: `2.0.0`,
            },
          });

          await run(`install`);

          // Verify that the workspace dependency was resolved from catalog
          const lockfile = await xfs.readFilePromise(`${path}/yarn.lock` as PortablePath, `utf8`);
          expect(lockfile).toMatch(/no-deps@npm:2\.0\.0/);
        },
      ),
    );
  });
});
