const {xfs} = require(`@yarnpkg/fslib`);

describe(`Features`, () => {
  describe(`enableNetwork`, () => {
    test(
      `it should prevent Yarn from accessing the network (yarn add)`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await expect((async () => {
          await run(`add`, `no-deps`, {enableNetwork: false});
        })()).rejects.toThrow();
      })
    );

    test(
      `it should fail to make requests to a blocked hostname`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await xfs.writeFilePromise(
          `${path}/.yarnrc.yml`,
          [
            `networkSettings:`,
            `  "registry.yarnpkg.com":`,
            `    enableNetwork: false`,
          ].join(`\n`)
        );

        await expect(run(`add`, `left-pad`, {registryUrl: `https://registry.yarnpkg.com`})).rejects.toThrow(
          / has been blocked because of your configuration settings/
        );

        await expect(run(`add`, `no-deps`)).resolves.toMatchObject({code: 0, stderr: ``});
      })
    );

    test(
      `it should work with git URLs`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await xfs.writeFilePromise(
          `${path}/.yarnrc.yml`,
          [
            `networkSettings:`,
            `  "github.com":`,
            `    enableNetwork: false`,
          ].join(`\n`)
        );

        await expect(run(`add`, `foo@git@github.com:foo/foo.git`)).rejects.toThrow(
          / has been blocked because of your configuration settings/
        );
      }
      )
    );
  });
});
