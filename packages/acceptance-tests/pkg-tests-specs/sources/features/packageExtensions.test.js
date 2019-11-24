import {xfs} from '@yarnpkg/fslib';

describe(`Features`, () => {
  describe(`Package Extensions`, () => {
    test(
      `it should allow to add regular dependencies to a package`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`various-requires`]: `1.0.0`,
          },
        },
        async ({path, run, source}) => {
          await xfs.writeFilePromise(`${path}/.yarnrc.yml`, `packageExtensions:\n  "various-requires@*":\n    dependencies:\n      no-deps: 1.0.0\n`);

          await run(`install`);

          await expect(source(`require('various-requires/invalid-require')`)).resolves.toMatchObject({
            name: `no-deps`,
            version: `1.0.0`,
          });
        },
      ),
    );

    test(
      `it should allow to add peer dependencies to a package`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`no-deps`]: `2.0.0`,
            [`various-requires`]: `1.0.0`,
          },
        },
        async ({path, run, source}) => {
          await xfs.writeFilePromise(`${path}/.yarnrc.yml`, `packageExtensions:\n  "various-requires@*":\n    peerDependencies:\n      no-deps: "*"\n`);

          await run(`install`);

          await expect(source(`require('various-requires/invalid-require')`)).resolves.toMatchObject({
            name: `no-deps`,
            version: `2.0.0`,
          });
        },
      ),
    );

    test(
      `it should store the original packages to the lockfile`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`various-requires`]: `1.0.0`,
          },
        },
        async ({path, run, source}) => {
          await xfs.writeFilePromise(`${path}/.yarnrc.yml`, `packageExtensions:\n  "various-requires@*":\n    dependencies:\n      no-deps: 1.0.0\n`);
          await run(`install`);

          await xfs.removePromise(`${path}/.yarnrc.yml`);
          await run(`install`);

          await expect(source(`require('various-requires/invalid-require')`)).rejects.toThrow();
        },
      ),
    );
  });
});
