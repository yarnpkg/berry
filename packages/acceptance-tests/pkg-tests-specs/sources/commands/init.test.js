const {
  fs: {createTemporaryFolder, mkdirp, readJson},
} = require(`pkg-tests-core`);

describe(`Commands`, () => {
  describe(`add`, () => {
    test(
      `it should create a new package.json in the local directory if it doesn't exist`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const tmp = await createTemporaryFolder();
        await mkdirp(`${tmp}/my-package`);

        await run(`init`, {
          cwd: `${tmp}/my-package`,
        });

        await expect(readJson(`${tmp}/my-package/package.json`)).resolves.toMatchObject({
          name: `my-package`,
        });
      }),
    );

    test(
      `it should create a new package.json in the specified directory if it doesn't exist`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const tmp = await createTemporaryFolder();
        await mkdirp(`${tmp}/my-package`);

        await run(`${tmp}/my-package`, `init`);

        await expect(readJson(`${tmp}/my-package/package.json`)).resolves.toMatchObject({
          name: `my-package`,
        });
      }),
    );

    test(
      `it should create a new package.json in the specified directory even if said directory doesn't exist`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const tmp = await createTemporaryFolder();

        await run(`${tmp}/my-package`, `init`);

        await expect(readJson(`${tmp}/my-package/package.json`)).resolves.toMatchObject({
          name: `my-package`,
        });
      }),
    );
  });
});
