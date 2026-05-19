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
      `it should report a warning when a workspace peer dependency is satisfied by the requester's dev dependency`,
      makeTemporaryMonorepoEnv({
        workspaces: [`packages/*`],
      }, {
        [`packages/a`]: {
          name: `a`,
          peerDependencies: {
            [`no-deps`]: `*`,
          },
          devDependencies: {
            [`no-deps`]: `1.0.0`,
          },
        },
        [`packages/b`]: {
          name: `b`,
          dependencies: {
            [`a`]: `workspace:^`,
          },
        },
      }, async ({run}) => {
        const {stdout} = await run(`install`);

        expect(stdout).toContain(`YN0093`);
        expect(stdout).toContain(`devDependency fallback`);
      }),
    );

    test(
      `it should report a warning when a workspace peer dependency is satisfied by the parent's dev dependency`,
      makeTemporaryMonorepoEnv({
        workspaces: [`packages/*`],
      }, {
        [`packages/a`]: {
          name: `a`,
          peerDependencies: {
            [`no-deps`]: `*`,
          },
        },
        [`packages/b`]: {
          name: `b`,
          dependencies: {
            [`a`]: `workspace:^`,
          },
          devDependencies: {
            [`no-deps`]: `1.0.0`,
          },
        },
      }, async ({run}) => {
        const {stdout} = await run(`install`);

        expect(stdout).toContain(`YN0093`);
        expect(stdout).toContain(`through devDependencies`);
      }),
    );

    test(
      `it should report collapsed a peer dependency warning when a direct peerDependency request is mismatched`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`mismatched-peer-deps-lvl1`]: `1.0.0`,
            [`no-deps`]: `1.1.0`,
          },
        },
        async ({path, run, source}) => {
          const {stdout} = await run(`install`);

          expect(stdout).toMatch(/no-deps is listed by your project with version 1\.1\.0 \(p[a-f0-9]{6}\), which doesn't satisfy what mismatched-peer-deps-lvl1 and other dependencies request \(1\.0\.0\)/);
        },
      ),
    );

    test(
      `it should report collapsed a peer dependency warning with corresponding root when a transitive peerDependency request is mismatched`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`mismatched-peer-deps-lvl0`]: `1.0.0`,
            [`no-deps`]: `1.1.0`,
          },
        },
        async ({path, run, source}) => {
          const {stdout} = await run(`install`);

          expect(stdout).toMatch(/no-deps is listed by your project with version 1\.1\.0 \(p[a-f0-9]{6}\), which doesn't satisfy what mismatched-peer-deps-lvl[12] \(via mismatched-peer-deps-lvl0\) and other dependencies request \(1\.0\.0\)/);
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

    test(
      `it should correctly resolve nested dependencies with different versions of types packages`,
      makeTemporaryEnv(
        {
          dependencies: {
            'peer-deps-implicit-types-conflict': `1.0.0`,
            '@types/no-deps': `1.0.0`,
          },
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(
            source(`require('@types/no-deps').version`),
          ).resolves.toEqual(`1.0.0`);

          await expect(
            source(`require(require.resolve('@types/no-deps', { paths: [require.resolve('peer-deps-implicit-types-conflict/package.json')] })).version`),
          ).resolves.toEqual(`2.0.0`);
        },
      ),
    );
  });
});

export {};
