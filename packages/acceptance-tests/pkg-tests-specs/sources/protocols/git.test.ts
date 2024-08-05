import {execUtils, semverUtils}      from '@yarnpkg/core';
import {Filename, npath, ppath, xfs} from '@yarnpkg/fslib';
import {parseSyml}                   from '@yarnpkg/parsers';
import {tests}                       from 'pkg-tests-core';

const TESTED_URLS = {
  // We've picked util-deprecate because it doesn't have any dependency, and
  // thus doesn't crash when installing through our mock registry. We also
  // could have made our own repository (and maybe we will), but it was simpler
  // this way.
  //
  // Edit 2019 Dec 6 - we now have the ability to serve local repositories
  // through our test server (cf following tests); still, these tests are
  // useful since they test various different protocols such as ssh.

  [`git://github.com/yarnpkg/util-deprecate.git#v1.0.1`]: {version: `1.0.1`, runOnCI: false},
  [`git+ssh://git@github.com/yarnpkg/util-deprecate.git#v1.0.1`]: {version: `1.0.1`, runOnCI: false},
  [`https://github.com/yarnpkg/util-deprecate.git#semver:^1.0.0`]: {version: `1.0.2`, runOnCI: false},
  [`https://github.com/yarnpkg/util-deprecate.git#semver:>=1.0.0 <1.0.2`]: {version: `1.0.1`, runOnCI: false},
  [`https://github.com/yarnpkg/util-deprecate.git#v1.0.0`]: {version: `1.0.0`, runOnCI: true},
  [`https://github.com/yarnpkg/util-deprecate.git#master`]: {version: `1.0.2`, runOnCI: true},
  [`https://github.com/yarnpkg/util-deprecate.git#b3562c2798507869edb767da869cd7b85487726d`]: {version: `1.0.0`, runOnCI: true},
};

describe(`Protocols`, () => {
  describe(`git:`, () => {
    for (const [url, {version, runOnCI}] of Object.entries(TESTED_URLS)) {
      const testFn = !process.env.GITHUB_ACTIONS || runOnCI
        ? test
        : test.skip;

      testFn(
        `it should resolve a git dependency (${url})`,
        makeTemporaryEnv(
          {
            dependencies: {[`util-deprecate`]: url},
          },
          async ({path, run, source}) => {
            await run(`install`);

            const content = await xfs.readFilePromise(ppath.join(path, Filename.lockfile), `utf8`);
            const lock = parseSyml(content);

            const key = `util-deprecate@${url}`;

            expect(lock).toMatchObject({[key]: {version}});
            expect(lock[`util-deprecate@${url}`].resolution).toMatchSnapshot();

            await expect(source(`require('util-deprecate/package.json')`)).resolves.toMatchObject({
              name: `util-deprecate`,
              version,
            });
          },
        ),
      );
    }

    test(
      `it should install dependencies and run prepack if needed`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`has-prepack`]: tests.startPackageServer().then(url => `${url}/repositories/has-prepack.git`),
          },
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(source(`require('has-prepack')`)).resolves.toEqual(42);
        },
      ),
    );

    test(
      `it shouldn't install dependencies for packages without prepack`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`no-prepack`]: tests.startPackageServer().then(url => `${url}/repositories/no-prepack.git`),
          },
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(source(`require('no-prepack')`)).resolves.toEqual(42);
        },
      ),
    );

    test(
      `it should support installing packages from projects in subfolders`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`pkg-a`]: tests.startPackageServer().then(url => `${url}/repositories/deep-projects.git#cwd=projects/pkg-a`),
            [`pkg-b`]: tests.startPackageServer().then(url => `${url}/repositories/deep-projects.git#cwd=projects/pkg-b`),
          },
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(source(`require('pkg-a/package.json')`)).resolves.toMatchObject({
            name: `pkg-a`,
            version: `1.0.0`,
          });

          await expect(source(`require('pkg-b/package.json')`)).resolves.toMatchObject({
            name: `pkg-b`,
            version: `1.0.0`,
          });
        },
      ),
    );

    test(
      `it should support installing workspace packages from projects in subfolders`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`lib-a`]: tests.startPackageServer().then(url => `${url}/repositories/deep-projects.git#cwd=projects/pkg-a&workspace=lib`),
            [`lib-b`]: tests.startPackageServer().then(url => `${url}/repositories/deep-projects.git#cwd=projects/pkg-b&workspace=lib`),
          },
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(source(`require('lib-a/package.json')`)).resolves.toMatchObject({
            name: `lib`,
            version: `1.0.0`,
          });

          await expect(source(`require('lib-b/package.json')`)).resolves.toMatchObject({
            name: `lib`,
            version: `1.0.0`,
          });

          await expect(source(`require('lib-a')`)).resolves.toEqual(`pkg-a`);
          await expect(source(`require('lib-b')`)).resolves.toEqual(`pkg-b`);
        },
      ),
    );

    test(
      `it should support installing specific workspaces`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`pkg-a`]: tests.startPackageServer().then(url => `${url}/repositories/workspaces.git#workspace=pkg-a`),
            [`pkg-b`]: tests.startPackageServer().then(url => `${url}/repositories/workspaces.git#workspace=pkg-b`),
          },
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(source(`require('pkg-a/package.json')`)).resolves.toMatchObject({
            name: `pkg-a`,
            version: `1.0.0`,
          });

          await expect(source(`require('pkg-b/package.json')`)).resolves.toMatchObject({
            name: `pkg-b`,
            version: `1.0.0`,
          });
        },
      ),
    );

    test(
      `it should use Yarn Classic to setup classic repositories`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`yarn-1-project`]: tests.startPackageServer().then(url => `${url}/repositories/yarn-1-project.git`),
          },
        },
        async ({path, run, source}) => {
          await expect(run(`install`, {
            env: {
              // if this is set then yarn 1 will be executed as if `--production` was passed during the install
              // but `yarn-1-project` requires dev dependencies to be present so this is a good way to
              // verify that yarn isn't throw off by this when handling the clone, install, and pack process
              // for git dependencies (see: https://classic.yarnpkg.com/lang/en/docs/cli/install/#toc-yarn-install-production-true-false)
              NODE_ENV: `production`,
            },
          })).resolves.toBeTruthy();

          await expect(source(`require('yarn-1-project')`)).resolves.toMatch(/\byarn\/1\.[0-9]+/);
        },
      ),
    );

    test(
      `it should use npm to setup npm repositories`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`npm-project`]: tests.startPackageServer().then(url => `${url}/repositories/npm-project.git`),
          },
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(source(`require('npm-project')`)).resolves.toMatch(/\bnpm\/[0-9]+/);
        },
      ),
    );

    test(
      `it should guarantee that all dependencies will be installed when using npm to setup npm repositories`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`npm-has-prepack`]: tests.startPackageServer().then(url => `${url}/repositories/npm-has-prepack.git`),
          },
        },
        async ({path, run, source}) => {
          await expect(run(`install`, {
            env: {
              // if this is set then npm will be executed as if `--omit=dev` was passed during the install
              // but `has-prepack-npm` requires dev dependencies to be present so this is a good way to
              // verify that yarn isn't throw off by this when handling the clone, install, and pack process
              // for git dependencies (see: https://docs.npmjs.com/cli/v8/using-npm/config#omit)
              NODE_ENV: `production`,

              // same for NPM_CONFIG_PRODUCTION which acts just like the `--production` flat during install step
              // (see: https://docs.npmjs.com/cli/v8/using-npm/config#environment-variables, https://docs.npmjs.com/cli/v8/using-npm/config#production)
              NPM_CONFIG_PRODUCTION: `true`,
              npm_config_production: `true`,

              // also force npm to use the package server as the registry so that the `has-bin-entry` dependency can be resolved
              NPM_CONFIG_REGISTRY: await tests.startPackageServer(),
            },
          })).resolves.toBeTruthy();
          await expect(source(`require('npm-has-prepack')`)).resolves.toEqual(42);
        },
      ),
    );

    test(
      `it should support installing specific workspaces from npm repositories`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`pkg-a`]: tests.startPackageServer().then(url => `${url}/repositories/npm-workspaces.git#workspace=pkg-a`),
            [`pkg-b`]: tests.startPackageServer().then(url => `${url}/repositories/npm-workspaces.git#workspace=pkg-b`),
          },
        },
        async ({path, run, source}) => {
          const {code, stdout, stderr} = await execUtils.execvp(`npm`, [`--version`], {cwd: path});
          if (code !== 0)
            throw new Error(`Couldn't get npm version: ${stderr}`);

          const npmVersion = stdout.trim();
          const doesNpmSupportWorkspaces = semverUtils.satisfiesWithPrereleases(npmVersion, `>=7.x`);

          if (doesNpmSupportWorkspaces) {
            await run(`install`);

            await expect(source(`require('pkg-a/package.json')`)).resolves.toMatchObject({
              name: `pkg-a`,
              version: `1.0.0`,
            });

            await expect(source(`require('pkg-b/package.json')`)).resolves.toMatchObject({
              name: `pkg-b`,
              version: `1.0.0`,
            });
          } else {
            await expect(run(`install`)).rejects.toThrow(`Workspaces aren't supported by npm@${npmVersion}`);
          }
        },
      ),
    );

    test(
      `it should not use Corepack to fetch Yarn Classic`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`yarn-1-project`]: tests.startPackageServer().then(url => `${url}/repositories/yarn-1-project.git`),
          },
        },
        async ({path, run, source}) => {
          // This checks that the `set version classic` part of `scriptUtils.prepareExternalProject` doesn't use Corepack.
          // The rest of the install will fail though.
          await expect(run(`install`, {
            env: {
              COREPACK_ROOT: npath.join(npath.fromPortablePath(path), `404`),
              YARN_ENABLE_INLINE_BUILDS: `true`,
            },
          })).rejects.toMatchObject({
            code: 1,
            stdout: expect.stringContaining(`Saving the new release`),
          });
        },
      ),
    );

    test(
      `it should not use Corepack to install repositories that are installed via Yarn 2+`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`no-lockfile-project`]: tests.startPackageServer().then(url => `${url}/repositories/no-lockfile-project.git`),
          },
        },
        async ({path, run, source}) => {
          await expect(run(`install`, {
            env: {
              COREPACK_ROOT: npath.join(npath.fromPortablePath(path), `404`),
              YARN_ENABLE_INLINE_BUILDS: `true`,
            },
          })).resolves.toBeDefined();
        },
      ),
    );

    test(
      `it should not add a 'packageManager' field to a Yarn classic project`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`yarn-1-project`]: tests.startPackageServer().then(url => `${url}/repositories/yarn-1-project.git`),
          },
        },
        async ({path, run, source}) => {
          await expect(run(`install`)).resolves.toBeTruthy();

          await expect(source(`require('yarn-1-project/package.json').packageManager`)).resolves.toBeUndefined();
        },
      ),
    );
  });
});
