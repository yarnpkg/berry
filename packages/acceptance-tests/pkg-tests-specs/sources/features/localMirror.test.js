import {xfs} from '@yarnpkg/fslib';

describe(`Features`, () => {
  describe(`Local Mirror`, () => {
    test(`it should store downloaded entries in the mirror`, makeTemporaryEnv({
      dependencies: {
        [`no-deps`]: `1.0.0`,
      },
    }, async ({path, run, source}) => {
      await run(`install`);

      const fileCount = (await xfs.readdirPromise(`${path}/.yarn/global/cache`)).length;
      expect(fileCount).toEqual(1);
    }));

    // Note that this test is particularly important because it's a security
    // test: if the cache entries end up in the mirror, it opens the way to
    // cache poisoning. One repository would be able to replace its copy of
    // Webpack by something malicious and cause it to be injected into the
    // global mirror.
    test(`it shouldn't store cache entries in the mirror`, makeTemporaryEnv({
      dependencies: {
        [`no-deps`]: `1.0.0`,
      },
    }, async ({path, run, source}) => {
      await run(`install`);
      await xfs.removePromise(`${path}/.yarn/global/cache`);
      await run(`install`);

      const fileCount = (await xfs.readdirPromise(`${path}/.yarn/global/cache`)).length;
      expect(fileCount).toEqual(0);
    }));
  });
});
