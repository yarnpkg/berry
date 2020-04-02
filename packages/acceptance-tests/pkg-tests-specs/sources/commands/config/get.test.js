describe(`Commands`, () => {
  describe(`config get`, () => {
    test(
      `it should print the requested configuration value for the current directory`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const {stdout} = await run(`config`, `get`, `pnpShebang`);
        expect(stdout).toContain(`'#!/usr/bin/env node'`);
      }),
    );
  });
});
