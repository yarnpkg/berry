describe(`Features`, () => {
  describe(`enableNetwork`, () => {
    test(
      `it should let Yarn reuse the package metadata from its cache`,
      makeTemporaryEnv({}, {
        enableGlobalCache: false,
      }, async ({path, run, source}) => {
        await run(`add`, `no-deps`);
        await run(`remove`, `no-deps`);

        await run(`add`, `no-deps`, {
          enableNetwork: false,
          enableOfflineMode: true,
        });

        await expect(source(`require('no-deps/package.json')`)).resolves.toMatchObject({
          name: `no-deps`,
          version: `2.0.0`,
        });
      }),
    );

    test(
      `it should fix the 'latest' tag to reference the highest version found in the cache`,
      makeTemporaryEnv({}, {
        enableGlobalCache: false,
      }, async ({path, run, source}) => {
        await run(`add`, `no-deps@1.0.0`);
        await run(`remove`, `no-deps`);

        await run(`add`, `no-deps`, {
          enableNetwork: false,
          enableOfflineMode: true,
        });

        await expect(source(`require('no-deps/package.json')`)).resolves.toMatchObject({
          name: `no-deps`,
          version: `1.0.0`,
        });
      }),
    );
  });
});
