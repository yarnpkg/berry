import {PortablePath, xfs} from '@yarnpkg/fslib';
import {yarn}              from 'pkg-tests-core';

describe(`Features`, () => {
  describe(`Package Extensions`, () => {
    test(
      `it should allow to add regular dependencies to a package`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`various-requires`]: `1.0.0`,
          },
        },
        async ({path, run, source}) => {
          await yarn.writeConfiguration(path, {
            packageExtensions: {
              [`various-requires@*`]: {
                dependencies: {
                  [`no-deps`]: `1.0.0`,
                },
              },
            },
          });

          await run(`install`);

          await expect(source(`require('various-requires/invalid-require')`)).resolves.toMatchObject({
            name: `no-deps`,
            version: `1.0.0`,
          });
        },
      ),
    );

    test(
      `it should allow to add peer dependencies to a package`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`no-deps`]: `2.0.0`,
            [`various-requires`]: `1.0.0`,
          },
        },
        async ({path, run, source}) => {
          await yarn.writeConfiguration(path, {
            packageExtensions: {
              [`various-requires@*`]: {
                peerDependencies: {
                  [`no-deps`]: `*`,
                },
              },
            },
          });

          await run(`install`);

          await expect(source(`require('various-requires/invalid-require')`)).resolves.toMatchObject({
            name: `no-deps`,
            version: `2.0.0`,
          });
        },
      ),
    );

    test(
      `it should store the original packages to the lockfile`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`various-requires`]: `1.0.0`,
          },
        },
        async ({path, run, source}) => {
          await yarn.writeConfiguration(path, {
            packageExtensions: {
              [`various-requires@*`]: {
                dependencies: {
                  [`no-deps`]: `1.0.0`,
                },
              },
            },
          });

          await run(`install`);

          await xfs.removePromise(`${path}/.yarnrc.yml` as PortablePath);
          await run(`install`);

          await expect(source(`require('various-requires/invalid-require')`)).rejects.toMatchObject({
            externalException: {
              code: `MODULE_NOT_FOUND`,
              pnpCode: `UNDECLARED_DEPENDENCY`,
            },
          });
        },
      ),
    );

    test(
      `it should warn on unused package extensions`,
      makeTemporaryEnv(
        {},
        async ({path, run, source}) => {
          await yarn.writeConfiguration(path, {
            packageExtensions: {
              [`various-requires@*`]: {
                dependencies: {
                  [`no-deps`]: `1.0.0`,
                },
              },
            },
          });

          await expect(run(`install`)).resolves.toMatchObject({
            stdout: expect.stringContaining(`various-requires ➤ dependencies ➤ no-deps: No matching package in the dependency tree; you may not need this rule anymore.`),
          });
        },
      ),
    );

    test(
      `it should warn on unneeded package extensions (dependencies)`,
      makeTemporaryEnv(
        {},
        async ({path, run, source}) => {
          await yarn.writeConfiguration(path, {
            packageExtensions: {
              [`one-fixed-dep@*`]: {
                dependencies: {
                  [`no-deps`]: `1.0.0`,
                },
              },
            },
          });

          await expect(run(`add`, `one-fixed-dep@1.0.0`)).resolves.toMatchObject({
            stdout: expect.stringContaining(`one-fixed-dep ➤ dependencies ➤ no-deps: This rule seems redundant when applied on the original package; the extension may have been applied upstream.`),
          });
        },
      ),
    );

    test(
      `it should warn on unneeded package extensions (peerDependenciesMeta)`,
      makeTemporaryEnv(
        {},
        async ({path, run, source}) => {
          await yarn.writeConfiguration(path, {
            packageExtensions: {
              [`optional-peer-deps@*`]: {
                peerDependenciesMeta: {
                  [`no-deps`]: {
                    optional: true,
                  },
                },
              },
            },
          });

          await expect(run(`add`, `optional-peer-deps`)).resolves.toMatchObject({
            stdout: expect.stringContaining(`optional-peer-deps ➤ peerDependenciesMeta ➤ no-deps ➤ optional: This rule seems redundant when applied on the original package; the extension may have been applied upstream.`),
          });
        },
      ),
    );
  });
});
