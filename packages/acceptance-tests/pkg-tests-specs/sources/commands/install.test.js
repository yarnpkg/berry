describe(`Commands`, () => {
  describe(`add`, () => {
    test(
      `it should print the logs to the standard output when using --inline-builds`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps-scripted`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        const {stdout} = await run(`install`, `--inline-builds`);

        await expect(stdout).toMatchSnapshot();
      }),
    );
  });
});
