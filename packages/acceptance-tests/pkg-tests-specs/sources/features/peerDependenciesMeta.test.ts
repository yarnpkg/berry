import {Filename, ppath, xfs} from '@yarnpkg/fslib';

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
      `it should report collapsed mismatched peer dependency warnings when a set of mismatched peerDependency requirements is detected`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`mismatched-peer-deps-lvl0`]: `1.0.0`,
            [`no-deps`]: `1.1.0`,
          },
        },
        async ({path, run, source}) => {
          const {stdout} = await run(`install`);

          expect(stdout).toMatch(/provides no-deps \(p[0-9a-f]{5}\) with version 1.1.0, which doesn't satisfy what mismatched-peer-deps-lvl0 and some of its descendants request/);
        },
      ),
    );

    test(
      `it should automatically add corresponding '@types' optional peer dependencies`,
      makeTemporaryEnv(
        {
          dependencies: {
            foo: `portal:./foo`,
            "no-deps": `1.0.0`,
            "@types/no-deps": `1.0.0`,
          },
        },
        async ({path, run, source}) => {
          await xfs.mkdirPromise(ppath.join(path, `foo` as Filename), {
            recursive: true,
          });
          await xfs.writeJsonPromise(
            ppath.join(path, `foo` as Filename, Filename.manifest),
            {
              name: `foo`,
              peerDependenciesMeta: {
                "no-deps": {
                  optional: true,
                },
              },
            },
          );

          await expect(run(`install`)).resolves.toMatchObject({
            code: 0,
            stdout: expect.not.stringContaining(`YN0002`),
          });

          await expect(
            source(`
                  require
                    .resolve('@types/no-deps', { paths: [require.resolve('foo/package.json')] })
                    .replace(/\\\\/g, '/')`),
          ).resolves.toContain(`/node_modules/@types/no-deps/`);
        },
      ),
    );
  });
});

export {};
