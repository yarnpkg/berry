
const {fs: {writeJson}} = require(`pkg-tests-core`);

describe(`Protocols`, () => {
  describe(`workspace:`, () => {
    test(
      `it should recognize prereleases in wildcard ranges`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`docs`, `components`],
        },
        async ({path, run, source}) => {
          await writeJson(`${path}/docs/package.json`, {
            name: `docs`,
            private: true,
            dependencies: {
              components: `workspace:*`,
            },
          });
          await writeJson(`${path}/components/package.json`, {
            name: `components`,
            version: `1.0.0-alpha.0`,
          });

          await expect(run(`install`)).resolves.toBeTruthy();
        },
      ),
    );
  });
});
