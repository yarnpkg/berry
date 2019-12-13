const {npath, xfs} = require(`@yarnpkg/fslib`);
const {
  fs: {writeFile, writeJson},
} = require('pkg-tests-core');

describe(`Plug'n'Play API`, () => {
  test(
    `it should expose VERSIONS`,
    makeTemporaryEnv({}, async ({path, run, source}) => {
      await run(`install`);

      await expect(source(`require('pnpapi').VERSIONS`)).resolves.toMatchObject({std: 3});
    }),
  );

  describe(`std - v1`, () => {
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

    describe(`getPackageInformation`, () => {
      test(
        `it should return the package location`,
        makeTemporaryEnv({}, async ({path, run, source}) => {
          await run(`install`);

          await expect(
            source(`typeof require('pnpapi').getPackageInformation({name: null, reference: null}).packageLocation`),
          ).resolves.toEqual(
            `string`,
          );
        }),
      );

      test(
        `it should return the package dependencies`,
        makeTemporaryEnv({
          dependencies: {
            [`no-deps`]: `1.0.0`,
          },
        }, async ({path, run, source}) => {
          await run(`install`);

          await expect(
            source(`[...require('pnpapi').getPackageInformation({name: null, reference: null}).packageDependencies]`),
          ).resolves.toEqual([
            [`no-deps`, `npm:1.0.0`],
          ]);
        }),
      );
    });

    describe(`resolveRequest`, () => {
      test(
        `it should return the path to the PnP file when 'pnpapi' is requested`,
        makeTemporaryEnv({}, async ({path, run, source}) => {
          await run(`install`);

          await expect(
            source(`require('pnpapi').resolveRequest('pnpapi', ${JSON.stringify(`${npath.fromPortablePath(path)}/`)})`),
          ).resolves.toEqual(
            npath.fromPortablePath(`${path}/.pnp.js`),
          );
        }),
      );

      test(
        `it should return null for builtins`,
        makeTemporaryEnv({}, async ({path, run, source}) => {
          await run(`install`);

          await expect(
            source(`require('pnpapi').resolveRequest('fs', ${JSON.stringify(`${npath.fromPortablePath(path)}/`)})`)
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
              source(`require('pnpapi').resolveRequest('fs', ${JSON.stringify(`${npath.fromPortablePath(path)}/`)}, {considerBuiltins: false})`),
            ).resolves.toEqual(
              npath.fromPortablePath(`${path}/fs/index.js`),
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
            source(`require('pnpapi').resolveRequest('./foo', ${JSON.stringify(`${npath.fromPortablePath(path)}/`)}, {extensions: ['.bar']})`),
          ).resolves.toEqual(
            npath.fromPortablePath(`${path}/foo.bar`),
          );
        }),
      );
    });
  });

  describe(`std - v2`, () => {
    test(
      `it should use .pnpCode to expose semantic errors`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await run(`install`);

        await expect(source(`(() => { try { require('pnpapi').resolveRequest('no-deps', ${JSON.stringify(`${path}/`)}) } catch (error) { return error } })()`)).resolves.toMatchObject({
          pnpCode: `UNDECLARED_DEPENDENCY`,
        });
      }),
    );
  });

  describe(`std - v3`, () => {
    test(
      `it should expose getDependencyTreeRoots`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await run(`install`);

        await expect(source(`typeof require('pnpapi').getDependencyTreeRoots`)).resolves.toEqual(`function`);
      }),
    );

    describe(`getPackageInformation`, () => {
      test(
        `it should return the package linkage (hard link)`,
        makeTemporaryEnv({
          dependencies: {
            [`no-deps`]: `1.0.0`,
          },
        }, async ({path, run, source}) => {
          await run(`install`);

          const reference = await source(
            `require('pnpapi').getPackageInformation({name: null, reference: null}).packageDependencies.get('no-deps')`
          );

          await expect(
            source(`require('pnpapi').getPackageInformation({name: 'no-deps', reference: ${JSON.stringify(reference)}}).linkType`),
          ).resolves.toEqual(
            `HARD`,
          );
        }),
      );

      test(
        `it should return the package linkage (soft link)`,
        makeTemporaryEnv({
          dependencies: {
            [`self`]: `link:.`,
          },
        }, async ({path, run, source}) => {
          await run(`install`);

          const reference = await source(
            `require('pnpapi').getPackageInformation({name: null, reference: null}).packageDependencies.get('self')`
          );

          await expect(
            source(`require('pnpapi').getPackageInformation({name: 'self', reference: ${JSON.stringify(reference)}}).linkType`),
          ).resolves.toEqual(
            `SOFT`,
          );
        }),
      );
    });

    describe(`getDependencyTreeRoots`, () => {
      test(
        `it should return the workspaces (no children)`,
        makeTemporaryEnv({
          name: `my-package`,
        }, async ({path, run, source}) => {
          await run(`install`);

          await expect(
            source(`require('pnpapi').getDependencyTreeRoots()`),
          ).resolves.toEqual([
            expect.objectContaining({name: `my-package`}),
          ]);
        }),
      );

      test(
        `it should return the workspaces (multiple workspaces)`,
        makeTemporaryEnv({
          name: `my-package`,
          private: true,
          workspaces: [`packages/*`],
        }, async ({path, run, source}) => {
          await xfs.mkdirpPromise(`${path}/packages/workspace-a`);
          await xfs.writeJsonPromise(`${path}/packages/workspace-a/package.json`, {name: `workspace-a`});

          await xfs.mkdirpPromise(`${path}/packages/workspace-b`);
          await xfs.writeJsonPromise(`${path}/packages/workspace-b/package.json`, {name: `workspace-b`});

          await run(`install`);

          await expect(
            source(`require('pnpapi').getDependencyTreeRoots()`),
          ).resolves.toEqual([
            expect.objectContaining({name: `my-package`}),
            expect.objectContaining({name: `workspace-a`}),
            expect.objectContaining({name: `workspace-b`}),
          ]);
        }),
      );
    });
  });

  describe(`resolveVirtual - v1`, () => {
    describe(`resolveVirtual`, () => {
      test(
        `it should return null when the specified path isn't a virtual`,
        makeTemporaryEnv({
          dependencies: {
            [`no-deps`]: `1.0.0`,
          },
        }, async ({path, run, source}) => {
          await run(`install`);

          await expect(
            source(`require('pnpapi').resolveVirtual(require.resolve('no-deps'))`),
          ).resolves.toEqual(null);
        }),
      );

      test(
        `it should return the transformed path when possible`,
        makeTemporaryEnv({
          dependencies: {
            [`peer-deps`]: `1.0.0`,
          },
        }, async ({path, run, source}) => {
          await run(`install`);

          const virtualPath = await source(`require.resolve('peer-deps')`);

          // Sanity check: to ensure that the test actually tests something :)
          expect(virtualPath).toMatch(`${npath.sep}$$virtual${npath.sep}`);

          const physicalPath = await source(`require('pnpapi').resolveVirtual(require.resolve('peer-deps'))`);

          expect(typeof physicalPath).toEqual(`string`);
          expect(physicalPath).not.toEqual(virtualPath);
          expect(xfs.existsSync(physicalPath)).toEqual(true);
        }),
      );
    });
  });
});
