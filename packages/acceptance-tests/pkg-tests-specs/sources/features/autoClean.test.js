import {xfs} from '@yarnpkg/fslib';

describe(`autoClean`, () => {
  test(`it should remove inactive entries from the cache`, makeTemporaryEnv({
    dependencies: {
      [`one-fixed-dep`]: `1.0.0`,
    },
  }, async ({path, run, source}) => {
    await run(`install`);
    const fileCount1 = (await xfs.readdirPromise(`${path}/.yarn/cache`)).length;

    await run(`remove`, `one-fixed-dep`);
    const fileCount2 = (await xfs.readdirPromise(`${path}/.yarn/cache`)).length;

    expect(fileCount2).toEqual(fileCount1 - 2);
  }));

  test(`it shouldn't remove active entries from the cache`, makeTemporaryEnv({
    dependencies: {
      [`no-deps`]: `1.0.0`,
      [`one-fixed-dep`]: `1.0.0`,
    },
  }, async ({path, run, source}) => {
    await run(`install`);
    const fileCount1 = (await xfs.readdirPromise(`${path}/.yarn/cache`)).length;

    await run(`remove`, `one-fixed-dep`);
    const fileCount2 = (await xfs.readdirPromise(`${path}/.yarn/cache`)).length;

    expect(fileCount2).toEqual(fileCount1 - 1);
  }));
});
