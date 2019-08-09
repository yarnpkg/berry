const {
  fs: {readJson, readFile},
  tests: {getPackageDirectoryPath},
} = require('pkg-tests-core');
const {parseSyml} = require('@berry/parsers');

describe(`Protocols`, () => {
  describe(`git:`, () => {
    test(
      `it should resolve a dependency with git tag`,
      makeTemporaryEnv(
        {
          dependencies: {[`util-deprecate`]: `git://github.com/TooTallNate/util-deprecate.git#v1.0.1`},
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(readJson(`${path}/package.json`)).resolves.toMatchObject({
            dependencies: {
              [`util-deprecate`]: `git://github.com/TooTallNate/util-deprecate.git#v1.0.1`,
            },
          });

          const content = await readFile(`${path}/yarn.lock`, `utf8`);
          const lock = parseSyml(content);

          await expect(lock).toMatchObject({
            [`util-deprecate@git://github.com/TooTallNate/util-deprecate.git#v1.0.1`]: {
                "version": "1.0.1"
            }
          });
        },
      ),
    );
  });
});
