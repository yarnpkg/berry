export {};

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
          pnpFallbackMode: `dependencies-only`,
          pnpMode: `loose`,
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(source(`require('various-requires/invalid-require')`)).rejects.toMatchObject({
            externalException: {
              code: `MODULE_NOT_FOUND`,
              pnpCode: `UNDECLARED_DEPENDENCY`,
            },
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
          pnpFallbackMode: `dependencies-only`,
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
      `it should allow resolutions to top-level hoisting candidates (even if they have peer dependencies)`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`no-deps`]: `1.0.0`,
            [`forward-peer-deps`]: `1.0.0`,
          },
        },
        {
          pnpFallbackMode: `all`,
          pnpMode: `loose`,
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(source(`require('peer-deps')`)).resolves.toMatchObject({
            name: `peer-deps`,
            version: `1.0.0`,
          });
        },
      ),
    );

    test(
      `it should allow resolutions to top-level hoisting candidates (even if it's an unmet peer dependency)`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`peer-deps-lvl1`]: `1.0.0`,
            [`one-fixed-dep`]: `1.0.0`,
          },
        },
        {
          pnpFallbackMode: `dependencies-only`,
          pnpMode: `loose`,
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(source(`require('peer-deps-lvl1')`)).resolves.toMatchObject({
            name: `peer-deps-lvl1`,
            version: `1.0.0`,
            peerDependencies: {
              [`no-deps`]: {
                version: `1.0.0`,
              },
            },
            dependencies: {
              [`peer-deps-lvl2`]: {
                peerDependencies: {
                  [`no-deps`]: {
                    version: `1.0.0`,
                  },
                },
              },
            },
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
          pnpFallbackMode: `dependencies-only`,
          pnpMode: `loose`,
        },
        async ({path, run, source}) => {
          await run(`install`);

          const {stderr} = await run(`node`, `-e`, `require('various-requires/invalid-require')`);
          expect(stderr).toMatch(/various-requires tried to access no-deps, but it isn't declared in its dependencies/);
        },
      ),
    );

    test(
      `it should install a root workspace without any dependencies (unnamed)`,
      makeTemporaryEnv(
        {},
        {
          pnpMode: `loose`,
        },
        async ({path, run, source}) => {
          await expect(run(`install`)).resolves.toBeTruthy();
        },
      ),
    );

    test(
      `it should install a root workspace without any dependencies (named)`,
      makeTemporaryEnv(
        {name: `workspace`},
        {
          pnpMode: `loose`,
        },
        async ({path, run, source}) => {
          await expect(run(`install`)).resolves.toBeTruthy();
        },
      ),
    );
  });
});
