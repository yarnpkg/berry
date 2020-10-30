describe(`Commands`, () => {
  describe(`exec`, () => {
    test(
      `it should preserve the exit code`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await run(`install`);
        await expect(run(`exec`, `run`, `foo`)).rejects.toMatchObject({
          code: 1,
          stdout: expect.stringContaining(`Usage Error: Couldn't find a script named "foo"`),
        });
      })
    );
  });
});
