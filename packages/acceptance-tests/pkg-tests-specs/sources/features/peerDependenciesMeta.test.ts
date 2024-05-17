describe(`Features`, () => {
  describe(`peerDependenciesMeta`, () => {
    test(
      `it should report a warning when omitting a peer dependencies`,
      makeTemporaryEnv(
        {
          dependencies: {[`peer-deps`]: `1.0.0`},
        },
        async ({path, run, source}) => {
          const {stdout} = await run(`install`);

          expect(stdout).toContain(`YN0002`);
        },
      ),
    );

    test(
      `it should not report a warning when omitting an optional peer dependency`,
      makeTemporaryEnv(
        {
          dependencies: {[`optional-peer-deps`]: `1.0.0`},
        },
        async ({path, run, source}) => {
          const {stdout} = await run(`install`);

          expect(stdout).not.toContain(`YN0002`);
        },
      ),
    );

    test(
      `it should report collapsed a peer dependency warning when a set of mismatched peerDependency requirements is detected`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`mismatched-peer-deps-lvl0`]: `1.0.0`,
            [`no-deps`]: `1.1.0`,
          },
        },
        async ({path, run, source}) => {
          const {stdout} = await run(`install`);

          expect(stdout).toMatch(/no-deps is listed by your project with version 1\.1\.0 \(p[a-f0-9]{5}\), which doesn't satisfy what mismatched-peer-deps-lvl0 and other dependencies request \(1\.0\.0\)/);
        },
      ),
    );

    test(
      `it should be able to access an implicit peer dependency`,
      makeTemporaryEnv(
        {
          dependencies: {
            'optional-peer-deps-implicit': `1.0.0`,
            'no-deps': `1.0.0`,
          },
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(
            source(`
            require(require.resolve('no-deps', { paths: [require.resolve('optional-peer-deps-implicit/package.json')] })) === require('no-deps')`),
          ).resolves.toEqual(true);
        },
      ),
    );

    test(
      `it should automatically add corresponding '@types' optional peer dependencies`,
      makeTemporaryEnv(
        {
          dependencies: {
            'optional-peer-deps-implicit': `1.0.0`,
            '@types/no-deps': `1.0.0`,
          },
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(
            source(`require(require.resolve('@types/no-deps', { paths: [require.resolve('optional-peer-deps-implicit/package.json')] })) === require('@types/no-deps')`),
          ).resolves.toEqual(true);
        },
      ),
    );
  });
});

export {};
