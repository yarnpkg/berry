const {
  fs: {readFile},
} = require('pkg-tests-core');
const {parseSyml} = require('@yarnpkg/parsers');

const TESTED_URLS = {
  // We've picked util-deprecate because it doesn't have any dependency, and thus
  // doesn't crash when installing through our mock registry. We also could have
  // made our own repository (and maybe we will), but it was simpler this way.
  [`git://github.com/TooTallNate/util-deprecate.git#v1.0.1`]: {version: `1.0.1`, ci: false},
  [`git+ssh://git@github.com/TooTallNate/util-deprecate.git#v1.0.1`]: {version: `1.0.1`, ci: false},
  [`https://github.com/TooTallNate/util-deprecate.git#v1.0.0`]: {version: `1.0.0`},
  [`https://github.com/TooTallNate/util-deprecate.git#master`]: {version: `1.0.2`},
  [`https://github.com/TooTallNate/util-deprecate.git#b3562c2`]: {version: `1.0.0`},
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

            await expect(lock).toMatchObject({
              [`util-deprecate@${url}`]: {
                version,
                resolution: `util-deprecate@${url}`,
              },
            });

            await expect(source(`require('util-deprecate/package.json')`)).resolves.toMatchObject({
              name: `util-deprecate`,
              version,
            });
          },
        ),
      );
    }
  });
});
