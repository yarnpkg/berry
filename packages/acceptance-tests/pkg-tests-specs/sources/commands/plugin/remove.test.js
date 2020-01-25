describe(`Commands`, () => {
  describe(`remove plugin`, () => {
    test(
      `it should remove a plugin via its plugin name`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await run(`plugin`, `import`, require.resolve(`@yarnpkg/monorepo/scripts/plugin-hello-world.js`));
        await run(`plugin`, `remove`, require.resolve(`@yarnpkg/monorepo/scripts/plugin-hello-world.js`));
        // some way to check if the file is been removed also the path and spec from the .yarnrc.yml file!!
      }),
    );
  });
});
