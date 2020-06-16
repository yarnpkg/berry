import {xfs} from '@yarnpkg/fslib';

describe(`Mirror`, () => {
  describe(`enableMirror`, () => {
    test(
      `it should cache the file after the first download`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await run(`add`, `no-deps`);
        await xfs.removePromise(`${path}/.yarn/cache`);
        await run(`install`, {enableNetwork: false});
      }),
    );

    test(
      `it should download the packages everytime when disabled`,
      makeTemporaryEnv({}, {
        enableMirror: false,
      }, async ({path, run, source}) => {
        await run(`add`, `no-deps`);
        await xfs.removePromise(`${path}/.yarn/cache`);
        await expect(run(`install`, {enableNetwork: false})).rejects.toThrow();
      }),
    );
  });
});
