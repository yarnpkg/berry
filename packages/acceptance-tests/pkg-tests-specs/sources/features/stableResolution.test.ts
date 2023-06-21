export {};

describe(`Features`, () => {
  describe(`Stable Resolution`, () => {
    test(
      `it should favor the smallest resolutions (direct)`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`no-deps`]: `^1.0.0`,
          },
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(source(`require('no-deps')`)).resolves.toMatchObject({
            name: `no-deps`,
            version: `1.0.0`,
          });
        },
      ),
    );

    test(
      `it should favor the smallest resolutions (transitive)`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`one-range-dep`]: `1.0.0`,
          },
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(source(`require('one-range-dep')`)).resolves.toMatchObject({
            name: `one-range-dep`,
            version: `1.0.0`,
            dependencies: {
              [`no-deps`]: {
                name: `no-deps`,
                version: `1.0.0`,
              },
            },
          });
        },
      ),
    );

    test(
      `it should accept higher resolutions is they are used elsewhere on the tree (direct)`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`no-deps`]: `^1.0.0`,
            [`one-fixed-dep`]: `1.1.0`,
          },
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(source(`require('no-deps')`)).resolves.toMatchObject({
            name: `no-deps`,
            version: `1.1.0`,
          });
        },
      ),
    );

    test(
      `it should accept higher resolutions is they are used elsewhere on the tree (transitive)`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`one-range-dep`]: `1.0.0`,
            [`one-fixed-dep`]: `1.1.0`,
          },
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(source(`require('one-range-dep')`)).resolves.toMatchObject({
            name: `one-range-dep`,
            version: `1.0.0`,
            dependencies: {
              [`no-deps`]: {
                name: `no-deps`,
                version: `1.1.0`,
              },
            },
          });
        },
      ),
    );
  });
});
