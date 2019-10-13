import {xfs} from '@yarnpkg/fslib';

describe(`Commands`, () => {
  describe(`cache clean`, () => {
    test(`it should remove the cache by default`, makeTemporaryEnv({
      dependencies: {
        [`no-deps`]: `1.0.0`,
      },
    }, async ({path, run, source}) => {
      await run(`install`);
      await run(`cache`, `clean`);

      expect(xfs.existsSync(`${path}/.yarn/cache`)).toEqual(false);
      expect(xfs.existsSync(`${path}/.yarn/global/cache`)).toEqual(true);
    }));

    test(`it should remove the mirror with --mirror`, makeTemporaryEnv({
      dependencies: {
        [`no-deps`]: `1.0.0`,
      },
    }, async ({path, run, source}) => {
      await run(`install`);
      await run(`cache`, `clean`, `--mirror`);

      expect(xfs.existsSync(`${path}/.yarn/cache`)).toEqual(true);
      expect(xfs.existsSync(`${path}/.yarn/global/cache`)).toEqual(false);
    }));

    test(`it should remove both cache and mirror with --all`, makeTemporaryEnv({
      dependencies: {
        [`no-deps`]: `1.0.0`,
      },
    }, async ({path, run, source}) => {
      await run(`install`);
      await run(`cache`, `clean`, `--all`);

      expect(xfs.existsSync(`${path}/.yarn/cache`)).toEqual(false);
      expect(xfs.existsSync(`${path}/.yarn/global/cache`)).toEqual(false);
    }));
  });
});
