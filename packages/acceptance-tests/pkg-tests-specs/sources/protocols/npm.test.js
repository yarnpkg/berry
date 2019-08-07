describe(`Protocols`, () => {
  describe(`npm:`, () => {
    test(
      `it should allow renaming packages`,
      makeTemporaryEnv(
        {
          dependencies: {[`no-deps`]: `npm:one-fixed-dep@1.0.0`},
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(source(`require('no-deps')`)).resolves.toMatchObject({
            name: `one-fixed-dep`,
            version: `1.0.0`,
          });
        },
      ),
    );

    test(
      `it should allow prefixing semver ranges with "v"`,
      makeTemporaryEnv(
        {
          dependencies: {[`no-deps`]: `npm:v1.0.0`},
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(source(`require('no-deps')`)).resolves.toMatchObject({
            name: `no-deps`,
            version: `1.0.0`,
          });
        },
      ),
    );
  });
});
