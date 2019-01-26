const {readdir} = require(`fs-extra`);

const {
  fs: {createTemporaryFolder, mkdirp, readJson},
} = require('pkg-tests-core');

describe(`Commands`, () => {
  describe(`add`, () => {
    test.concurrent(`it should remove inactive entries from the cache`, makeTemporaryEnv({
      dependencies: {
        [`one-fixed-dep`]: `1.0.0`,
      },
    }, async ({path, run, source}) => {
      await run(`install`);

      const fileCount1 = (await readdir(`${path}/.berry/cache`)).length;

      await run(`remove`, `one-fixed-dep`);
      await run(`cache`, `clean`);

      const fileCount2 = (await readdir(`${path}/.berry/cache`)).length;

      expect(fileCount2).toEqual(fileCount1 - 2);
    }));

    test.concurrent(`it shouldn't remove active entries from the cache`, makeTemporaryEnv({
      dependencies: {
        [`no-deps`]: `1.0.0`,
        [`one-fixed-dep`]: `1.0.0`,
      },
    }, async ({path, run, source}) => {
      await run(`install`);

      const fileCount1 = (await readdir(`${path}/.berry/cache`)).length;

      await run(`remove`, `one-fixed-dep`);
      await run(`cache`, `clean`);

      const fileCount2 = (await readdir(`${path}/.berry/cache`)).length;

      expect(fileCount2).toEqual(fileCount1 - 1);
    }));
  });
});
