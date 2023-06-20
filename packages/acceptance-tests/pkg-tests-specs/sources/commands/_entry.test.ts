export {};

describe(`Entry`, () => {
  describe(`version option`, () => {
    test(
      `it should print the version from the package.json when given --version`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const {stdout} = await run(`--version`);
        expect(stdout.trim()).toEqual(`X.Y.Z`);
      }),
    );

    test(
      `it should print the version from the package.json when given -v`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const {stdout} = await run(`-v`);
        expect(stdout.trim()).toEqual(`X.Y.Z`);
      }),
    );
  });
});
