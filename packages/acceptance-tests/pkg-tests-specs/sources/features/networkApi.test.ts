describe(`Features`, () => {
  describe(`NetworkApi`, () => {
    test(
      `it should fail to execute in an environment without global fetch`,
      makeTemporaryEnv({
        dependencies: {[`no-deps`]: `1.0.0`},
      }, {
        networkApi: `fetch`,
      }, async ({path, run, source}) => {
        await expect(run(`install`)).rejects.toThrow(
          `The networkApi setting is set to 'fetch', but the fetch API isn't available`,
        );
      }),
    );

    test(
      `it should work if fetch is exposed in the environment via node-fetch`,
      makeTemporaryEnv({
        dependencies: {[`no-deps`]: `1.0.0`},
      }, {
        networkApi: `fetch`,
      }, async ({path, run, source}) => {
        await run(`install`, {
          env: {
            NODE_OPTIONS: `--require ${require.resolve(`../../node-fetch-polyfill`)}`,
          },
        });
      }),
    );
  });
});

export {};
