describe(`Commands`, () => {
  describe(`rebuild`, () => {
    test(
      `it rebuild everything when called without arguments`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps-scripted`]: `1.0.0`,
          [`no-deps-scripted-bis`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        await expect(source(`require('no-deps-scripted/log')`)).resolves.toEqual([
          `preinstall`,
          `install`,
          `postinstall`,
        ]);

        await run(`rebuild`);

        await expect(source(`require('no-deps-scripted/log')`)).resolves.toEqual([
          `preinstall`,
          `install`,
          `postinstall`,
          `preinstall`,
          `install`,
          `postinstall`,
        ]);

        await expect(source(`require('no-deps-scripted-bis/log')`)).resolves.toEqual([
          `preinstall`,
          `install`,
          `postinstall`,
          `preinstall`,
          `install`,
          `postinstall`,
        ]);
      }),
      30000,
    );

    test(
      `it rebuild a single package when called with arguments`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps-scripted`]: `1.0.0`,
          [`no-deps-scripted-bis`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        await expect(source(`require('no-deps-scripted/log')`)).resolves.toEqual([
          `preinstall`,
          `install`,
          `postinstall`,
        ]);

        await run(`rebuild`, `no-deps-scripted`);

        await expect(source(`require('no-deps-scripted/log')`)).resolves.toEqual([
          `preinstall`,
          `install`,
          `postinstall`,
          `preinstall`,
          `install`,
          `postinstall`,
        ]);

        await expect(source(`require('no-deps-scripted-bis/log')`)).resolves.toEqual([
          `preinstall`,
          `install`,
          `postinstall`,
        ]);
      }),
      30000,
    );
  });
});
