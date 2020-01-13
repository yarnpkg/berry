describe(`Commands`, () => {
  describe(`plugin import`, () => {
    test(
      `it should support adding a plugin via its path`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await run(`plugin`, `import`, require.resolve(`@yarnpkg/monorepo/scripts/plugin-hello-world.js`));
        await run(`hello`, `--email`, `postmaster@example.org`);
      }),
    );
  });
});
