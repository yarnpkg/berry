describe(`Protocols`, () => {
  describe(`Semver`, () => {
    test(
      `it should allow prefixing semver ranges with "v"`,
      makeTemporaryEnv(
        {
          dependencies: {[`no-deps`]: `v1.0.0`},
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

    test(
      `it should allow semver ranges with build metadata`,
      makeTemporaryEnv(
        {
          dependencies: {[`no-deps-build-metadata`]: `1.0.0+123`},
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(source(`require('no-deps-build-metadata')`)).resolves.toMatchObject({
            name: `no-deps-build-metadata`,
            version: `1.0.0+123`,
          });
        },
      ),
    );
  });
});
