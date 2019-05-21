const {
  fs: {writeFile, writeJson},
} = require('pkg-tests-core');

describe(`Features`, () => {
  describe(`Resolutions`, () => {
    test(
      `it should support overriding packages with portals`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`one-fixed-dep`]: `1.0.0`,
          },
          resolutions: {
            [`no-deps`]: `portal:./my-package`,
          },
        },
        async ({path, run, source}) => {
          await writeFile(`${path}/my-package/index.js`, `module.exports = 42;\n`);
          await writeJson(`${path}/my-package/package.json`, {
            name: `no-deps`,
            version: `42.0.0`,
          });

          await run(`install`);

          await expect(source(`require('one-fixed-dep')`)).resolves.toMatchObject({
            name: `one-fixed-dep`,
            version: `1.0.0`,
            dependencies: {
              [`no-deps`]: 42,
            },
          });
        },
      ),
    );
  });
});
