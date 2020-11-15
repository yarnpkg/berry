const {xfs} = require(`@yarnpkg/fslib`);

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
      `it should not expand glob patterns`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await run(`install`);

        await xfs.writeFilePromise(`${path}/echo.js`, `process.stdout.write(process.argv[2])`);

        await expect(run(`exec`, `node`, `echo.js`, `*.js`)).resolves.toMatchObject({
          code: 0,
          stdout: expect.stringContaining(`*.js`),
        });
      })
    );
  });
});
