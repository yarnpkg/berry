const {
  fs: {createTemporaryFolder, mkdirp, readJson},
} = require('pkg-tests-core');

describe(`Commands`, () => {
  describe(`link`, () => {
    test.concurrent(
      `it should work with the classic link workflow`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const tmp = await createTemporaryFolder();
        await mkdirp(`${tmp}/my-package`);

        await run(`init`, {
          cwd: `${tmp}/my-package`,
        });

        await run(`link`, {
          cwd: `${tmp}/my-package`,
        });

        await run(`link`, `my-package`);

        await expect(readJson(`${path}/package.json`)).resolves.toMatchObject({
          dependencies: {
            [`my-package`]: `portal:${tmp}/my-package`
          },
        });
      }),
    );
  });
});
