const {NodeFS} = require(`@berry/fslib`);
const {
  fs: {writeFile, writeJson},
} = require('pkg-tests-core');

describe(`Plug'n'Play API (v1)`, () => {
  test(
    `it should expose VERSIONS`,
    makeTemporaryEnv({}, async ({path, run, source}) => {
      await run(`install`);

      await expect(source(`require('pnpapi').VERSIONS`)).resolves.toMatchObject({std: 1});
    }),
  );

  test(
    `it should expose resolveToUnqualified`,
    makeTemporaryEnv({}, async ({path, run, source}) => {
      await run(`install`);

      await expect(source(`typeof require('pnpapi').resolveToUnqualified`)).resolves.toEqual(`function`);
    }),
  );

  test(
    `it should expose resolveToUnqualified`,
    makeTemporaryEnv({}, async ({path, run, source}) => {
      await run(`install`);

      await expect(source(`typeof require('pnpapi').resolveUnqualified`)).resolves.toEqual(`function`);
    }),
  );

  test(
    `it should expose resolveRequest`,
    makeTemporaryEnv({}, async ({path, run, source}) => {
      await run(`install`);

      await expect(source(`typeof require('pnpapi').resolveRequest`)).resolves.toEqual(`function`);
    }),
  );

  describe(`resolveRequest`, () => {
    test(
      `it should return the path to the PnP file when 'pnpapi' is requested`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await run(`install`);

        await expect(
          source(`require('pnpapi').resolveRequest('pnpapi', ${JSON.stringify(`${NodeFS.fromPortablePath(path)}/`)})`),
        ).resolves.toEqual(
          NodeFS.fromPortablePath(`${path}/.pnp.js`),
        );
      }),
    );

    test(
      `it should return null for builtins`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await run(`install`);

        await expect(
          source(`require('pnpapi').resolveRequest('fs', ${JSON.stringify(`${NodeFS.fromPortablePath(path)}/`)})`)
        ).resolves.toEqual(
          null,
        );
      }),
    );

    test(
      `it should support the 'considerBuiltins' option`,
      makeTemporaryEnv(
        {
          dependencies: {[`fs`]: `link:./fs`},
        },
        async ({path, run, source}) => {
          await writeFile(`${path}/fs/index.js`, `
            module.exports = 'Hello world';
          `);

          await writeJson(`${path}/fs/package.json`, {
            name: `fs`,
            version: `1.0.0`,
          });

          await run(`install`);

          await expect(
            source(`require('pnpapi').resolveRequest('fs', ${JSON.stringify(`${NodeFS.fromPortablePath(path)}/`)}, {considerBuiltins: false})`),
          ).resolves.toEqual(
            NodeFS.fromPortablePath(`${path}/fs/index.js`),
          );
        },
      ),
    );

    test(
      `it should support the 'extensions' option`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await writeFile(`${path}/foo.bar`, `
          hello world
        `);

        await run(`install`);

        await expect(
          source(`require('pnpapi').resolveRequest('./foo', ${JSON.stringify(`${NodeFS.fromPortablePath(path)}/`)}, {extensions: ['.bar']})`),
        ).resolves.toEqual(
          NodeFS.fromPortablePath(`${path}/foo.bar`),
        );
      }),
    );
  });
});
