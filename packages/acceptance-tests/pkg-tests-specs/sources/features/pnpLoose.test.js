describe(`Features`, () => {
  describe(`PnP Loose`, () => {
    test(
      `it should throw an exception if a dependency tries to require something it doesn't own that isn't hoisted`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`various-requires`]: `1.0.0`,
          },
        },
        {
          pnpMode: `loose`,
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(source(`require('various-requires/invalid-require')`)).rejects.toBeTruthy();
          await expect(source(`{ try { require('various-requires/invalid-require') } catch (error) { return error } }`)).resolves.toMatchObject({
            code: `MODULE_NOT_FOUND`,
            pnpCode: `UNDECLARED_DEPENDENCY`,
          });
        },
      ),
    );

    test(
      `it should allow resolutions to top-level hoisting candidates`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`one-fixed-dep`]: `1.0.0`,
            [`various-requires`]: `1.0.0`,
          },
        },
        {
          pnpMode: `loose`,
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(source(`require('various-requires/invalid-require')`)).resolves.toMatchObject({
            name: `no-deps`,
            version: `1.0.0`,
          });
        },
      ),
    );

    test(
      `it should log an exception if a dependency tries to require something it doesn't own but that can be accessed through hoisting`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`one-fixed-dep`]: `1.0.0`,
            [`various-requires`]: `1.0.0`,
          },
        },
        {
          pnpMode: `loose`,
        },
        async ({path, run, source}) => {
          await run(`install`);

          const {stderr} = await run(`node`, `-e`, `require('various-requires/invalid-require')`);
          expect(stderr).toMatch(/various-requires tried to access no-deps, but it isn't declared in its dependencies/);
        },
      ),
    );  });
});
