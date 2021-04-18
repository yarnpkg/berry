const {npath} = require(`@yarnpkg/fslib`);

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

    test(
      `it should allow running shell scripts`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await run(`install`);
        await expect(run(`exec`, `echo $(pwd)/package.json`)).resolves.toMatchObject({
          code: 0,
          stdout: `${npath.fromPortablePath(path)}/package.json\n`,
        });
      })
    );
  });
});
