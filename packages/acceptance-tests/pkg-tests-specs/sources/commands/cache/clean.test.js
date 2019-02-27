const {readdir} = require(`fs-extra`);

const {
  fs: {createTemporaryFolder, mkdirp, readJson},
} = require('pkg-tests-core');

describe(`Commands`, () => {
  describe(`cache clean`, () => {
    test(`it should remove inactive entries from the cache`, makeTemporaryEnv({
      dependencies: {
        [`one-fixed-dep`]: `1.0.0`,
      },
    }, async ({path, run, source}) => {
      await run(`install`);

      const fileCount1 = (await readdir(`${path}/.yarn/cache`)).length;

      await run(`remove`, `one-fixed-dep`);
      await run(`cache`, `clean`);

      const fileCount2 = (await readdir(`${path}/.yarn/cache`)).length;

      expect(fileCount2).toEqual(fileCount1 - 2);
    }));

    test(`it shouldn't remove active entries from the cache`, makeTemporaryEnv({
      dependencies: {
        [`no-deps`]: `1.0.0`,
        [`one-fixed-dep`]: `1.0.0`,
      },
    }, async ({path, run, source}) => {
      await run(`install`);

      const fileCount1 = (await readdir(`${path}/.yarn/cache`)).length;

      await run(`remove`, `one-fixed-dep`);
      await run(`cache`, `clean`);

      const fileCount2 = (await readdir(`${path}/.yarn/cache`)).length;

      expect(fileCount2).toEqual(fileCount1 - 1);
    }));

    test(`it should remove inactive virtual entries even when their underlying package still exists`, makeTemporaryEnv({
      dependencies: {
        [`no-deps`]: `1.0.0`,
        [`peer-deps`]: `1.0.0`,
      },
    }, async ({path, run, source}) => {
      await run(`install`);

      const fileCount1 = (await readdir(`${path}/.yarn/virtual`)).length;

      await run(`remove`, `peer-deps`);
      await run(`cache`, `clean`);

      const fileCount2 = (await readdir(`${path}/.yarn/virtual`)).length;

      expect(fileCount2).toEqual(fileCount1 - 1);
    }));
  });
});
