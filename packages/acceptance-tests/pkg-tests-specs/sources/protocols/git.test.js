const {
  tests: {startPackageServer},
} = require(`pkg-tests-core`);
const {parseSyml} = require(`@yarnpkg/parsers`);
const {execUtils, semverUtils} = require(`@yarnpkg/core`);
const {npath, xfs} = require(`@yarnpkg/fslib`);

const TESTED_URLS = {
  // We've picked util-deprecate because it doesn't have any dependency, and
  // thus doesn't crash when installing through our mock registry. We also
  // could have made our own repository (and maybe we will), but it was simpler
  // this way.
  //
  // Edit 2019 Dec 6 - we now have the ability to serve local repositories
  // through our test server (cf following tests); still, these tests are
  // useful since they test various different protocols such as ssh.

  [`git://github.com/yarnpkg/util-deprecate.git#v1.0.1`]: {version: `1.0.1`, ci: false},
  [`git+ssh://git@github.com/yarnpkg/util-deprecate.git#v1.0.1`]: {version: `1.0.1`, ci: false},
  [`https://github.com/yarnpkg/util-deprecate.git#semver:^1.0.0`]: {version: `1.0.2`, ci: false},
  [`https://github.com/yarnpkg/util-deprecate.git#semver:>=1.0.0 <1.0.2`]: {version: `1.0.1`, ci: false},
  [`https://github.com/yarnpkg/util-deprecate.git#v1.0.0`]: {version: `1.0.0`},
  [`https://github.com/yarnpkg/util-deprecate.git#master`]: {version: `1.0.2`},
  [`https://github.com/yarnpkg/util-deprecate.git#b3562c2798507869edb767da869cd7b85487726d`]: {version: `1.0.0`},
};

describe(`Protocols`, () => {
  describe(`git:`, () => {
    for (const [url, {ci = true, version}] of Object.entries(TESTED_URLS)) {
      const testFn = !process.env.GITHUB_ACTIONS || ci
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

            const content = await xfs.readFilePromise(`${path}/yarn.lock`, `utf8`);
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
            [`has-prepack`]: startPackageServer().then(url => `${url}/repositories/has-prepack.git`),
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
            [`no-prepack`]: startPackageServer().then(url => `${url}/repositories/no-prepack.git`),
          },
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(source(`require('no-prepack')`)).resolves.toEqual(42);
        },
      ),
    );

    test(
      `it should support installing specific workspaces`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`pkg-a`]: startPackageServer().then(url => `${url}/repositories/workspaces.git#workspace=pkg-a`),
            [`pkg-b`]: startPackageServer().then(url => `${url}/repositories/workspaces.git#workspace=pkg-b`),
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
            [`yarn-1-project`]: startPackageServer().then(url => `${url}/repositories/yarn-1-project.git`),
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
            [`npm-project`]: startPackageServer().then(url => `${url}/repositories/npm-project.git`),
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
            [`npm-has-prepack`]: startPackageServer().then(url => `${url}/repositories/npm-has-prepack.git`),
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
              NPM_CONFIG_REGISTRY: await startPackageServer(),
            },
          })).resolves.toBeTruthy();
          await expect(source(`require('npm-has-prepack')`)).resolves.toEqual(42);
        },
      ),
      45000,
    );

    test(
      `it should support installing specific workspaces from npm repositories`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`pkg-a`]: startPackageServer().then(url => `${url}/repositories/npm-workspaces.git#workspace=pkg-a`),
            [`pkg-b`]: startPackageServer().then(url => `${url}/repositories/npm-workspaces.git#workspace=pkg-b`),
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
            [`yarn-1-project`]: startPackageServer().then(url => `${url}/repositories/yarn-1-project.git`),
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
      `it should not add a 'packageManager' field to a Yarn classic project`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`yarn-1-project`]: startPackageServer().then(url => `${url}/repositories/yarn-1-project.git`),
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
