export {};

describe(`Features`, () => {
  describe(`configExtend`, () => {
    it(`should extend the configuration rather than replace it (shapes)`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await run(`config`, `set`, `--home`, `supportedArchitectures.os`, `--json`, `["SOME_OS"]`);
        await run(`config`, `set`, `supportedArchitectures.cpu`, `--json`, `["SOME_CPU"]`);

        const {stdout} = await run(`config`, `get`, `supportedArchitectures`, `--json`);
        expect(stdout).toMatchJSON(expect.objectContaining({
          os: [`SOME_OS`],
          cpu: [`SOME_CPU`],
        }));
      }),
    );
  });
});
