describe(`Features`, () => {
  describe(`binary api`, () => {
    test(
      `it should export getDynamicLibs`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`no-deps`]: `1.0.0`,
          },
        },
        async ({path, run, source}) => {
          await run(`install`);
          // const {stdout} = await run(`config`, `get`, `yarnPath`);
          const api = require(`../../../../yarnpkg-cli/bundles/yarn.js`);
          expect(typeof api.getDynamicLibs).toBe(`function`);
          expect(api.getDynamicLibs().get(`@yarnpkg/core`).YarnVersion).toBeTruthy();
        },
      ),
    );
  });
});

export {};
