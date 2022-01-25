export {};

describe(`Commands`, () => {
  describe(`npm info`, () => {
    test(
      `it should return information about the latest version of a package if no range is specified`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const {stdout} = await run(`npm`, `info`, `no-deps`, `--json`);
        expect(stdout).toMatchJSON(expect.objectContaining({
          version: `2.0.0`,
        }));
      }),
    );

    test(
      `it should return information about a specific version if requested`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const {stdout} = await run(`npm`, `info`, `no-deps@1.0.0`, `--json`);
        expect(stdout).toMatchJSON(expect.objectContaining({
          version: `1.0.0`,
        }));
      }),
    );

    test(
      `it should return information about the highest version that satisfies a range`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const {stdout} = await run(`npm`, `info`, `no-deps@^1.0.0`, `--json`);
        expect(stdout).toMatchJSON(expect.objectContaining({
          version: `1.1.0`,
        }));
      }),
    );

    test(
      `it should return information about a tagged version if requested`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const {stdout} = await run(`npm`, `info`, `no-deps-tags@rc`, `--json`);
        expect(stdout).toMatchJSON(expect.objectContaining({
          version: `1.0.0-rc.1`,
        }));
      }),
    );
  });
});
