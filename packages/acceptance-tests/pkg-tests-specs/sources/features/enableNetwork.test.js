describe(`Features`, () => {
  describe(`enableNetwork`, () => {
    test(
      `it should prevent Yarn from accessing the network (yarn add)`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await expect((async () => {
          await run(`add`, `no-deps`, {enableNetwork: false});
        })()).rejects.toThrow();
      }),
    );
  });
});
