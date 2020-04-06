describe(`Commands`, () => {
  describe(`config get`, () => {
    test(
      `it should print the requested configuration value for the current directory`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await expect(run(`config`, `get`, `pnpShebang`)).resolves.toMatchObject({
          stdout: `#!/usr/bin/env node\n`,
        });
      }),
    );
  });
});
