describe(`Commands`, () => {
  describe(`help`, () => {
    test(
      `it should describe help`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await expect(run('help', 'help')).resolves.toMatchObject({
          stdout: expect.stringContaining(`Usage: help [... command]`),
        });
      }),
    );

    test(
      `it should describe workspaces list`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await expect(run('help', 'workspaces', 'list')).resolves.toMatchObject({
          stdout: expect.stringContaining(`Usage: workspaces list`),
        });
      }),
    );
  });
});
