const {
  fs: {readFile},
  tests: {startPackageServer},
} = require(`pkg-tests-core`);
const {parseSyml} = require(`@yarnpkg/parsers`);

const TESTED_URLS = {
  // We've picked util-deprecate because it doesn't have any dependency, and
  // thus doesn't crash when installing through our mock registry. We also
  // could have made our own repository (and maybe we will), but it was simpler
  // this way.
  //
  // Edit 2019 Dec 6 - we now have the ability to serve local repositories
  // through our test server (cf following tests); still, these tests are
  // useful since they test various different protocols such as ssh.

  [`git://github.com/TooTallNate/util-deprecate.git#v1.0.1`]: {version: `1.0.1`, ci: false},
  [`git+ssh://git@github.com/TooTallNate/util-deprecate.git#v1.0.1`]: {version: `1.0.1`, ci: false},
  [`https://github.com/TooTallNate/util-deprecate.git#semver:^1.0.0`]: {version: `1.0.2`, ci: false},
  [`https://github.com/TooTallNate/util-deprecate.git#semver:>=1.0.0 <1.0.2`]: {version: `1.0.1`, ci: false},
  [`https://github.com/TooTallNate/util-deprecate.git#v1.0.0`]: {version: `1.0.0`},
  [`https://github.com/TooTallNate/util-deprecate.git#master`]: {version: `1.0.2`},
  [`https://github.com/TooTallNate/util-deprecate.git#b3562c2798507869edb767da869cd7b85487726d`]: {version: `1.0.0`},
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

            const content = await readFile(`${path}/yarn.lock`, `utf8`);
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
      )
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
      )
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
      45000
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
          await run(`install`);

          await expect(source(`require('yarn-1-project')`)).resolves.toMatch(/\byarn\/1\.[0-9]+/);
        },
      ),
      45000
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
      45000
    );
  });
});
