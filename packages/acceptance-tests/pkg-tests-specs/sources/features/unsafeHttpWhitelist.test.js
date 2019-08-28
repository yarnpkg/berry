describe(`Features`, () => {
  describe(`unsafeHttpWhitelist`, () => {
    test(
      `it should prevent Yarn from using http by default`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps`]: `1.0.0`,
        },
      }, {
        unsafeHttpWhitelist: undefined,
      }, async ({path, run, source}) => {
        await expect((async () => {
          await run(`install`);
        })()).rejects.toThrow(/Unsafe http requests must be explicitly whitelisted in your configuration/);
      }),
    );
  });
});
