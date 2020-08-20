import {PortablePath} from '@yarnpkg/fslib';
import {fs}           from 'pkg-tests-core';

const {writeJson} = fs;

describe(`Protocols`, () => {
  describe(`workspace:`, () => {
    test(
      `it should recognize prereleases in wildcard ranges`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`docs`, `components`],
        },
        async ({path, run, source}) => {
          await writeJson(`${path}/docs/package.json` as PortablePath, {
            name: `docs`,
            private: true,
            dependencies: {
              components: `workspace:*`,
            },
          });
          await writeJson(`${path}/components/package.json` as PortablePath, {
            name: `components`,
            version: `1.0.0-alpha.0`,
          });

          await expect(run(`install`)).resolves.toBeTruthy();
        },
      ),
    );

    test(
      `it should support relative paths (without ./)`,
      makeTemporaryMonorepoEnv({
        workspaces: [`packages/*`],
        dependencies: {
          [`foo`]: `workspace:packages/foo`,
        },
      }, {
        [`packages/foo`]: {
          name: `foo`,
        },
      }, async ({path, run, source}) => {
        await expect(run(`install`)).resolves.toBeTruthy();
      })
    );

    test(
      `it should support relative paths (with ./)`,
      makeTemporaryMonorepoEnv({
        workspaces: [`packages/*`],
        dependencies: {
          [`foo`]: `workspace:./packages/foo`,
        },
      }, {
        [`packages/foo`]: {
          name: `foo`,
        },
      }, async ({path, run, source}) => {
        await expect(run(`install`)).resolves.toBeTruthy();
      })
    );
  });
});
