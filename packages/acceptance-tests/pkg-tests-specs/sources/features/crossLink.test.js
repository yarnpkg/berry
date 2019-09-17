describe(`Features`, () => {
  describe(`Cross-Link`, () => {
    test.skip(
      `it should allow Yarn to install packages from another language`,
      makeTemporaryEnv({
        dependencies: {
          [`one-fixed-dep-crosslink`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        await expect(source(`require('one-fixed-dep-crosslink')`)).resolves.toEqual(66);
      }),
    );
  });
});
