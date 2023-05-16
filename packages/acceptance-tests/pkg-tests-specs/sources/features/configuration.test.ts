import {Filename, PortablePath, ppath, xfs} from '@yarnpkg/fslib';

describe(`Features`, () => {
  describe(`Configuration`, () => {
    test(`it should return a helpful error if the rc file is wrong`, makeTemporaryEnv({
    }, async ({path, run, source}) => {
      await xfs.mkdirPromise(ppath.join(path, `..` as PortablePath), {recursive: true});

      await xfs.writeJsonPromise(ppath.join(path, `..` as PortablePath, Filename.rc), {
        packageExtensions: {
          "@lezer/html@*": {
            dependencies: {
              "@lezer/common": `*`,
              // Wrong indentation here, will throw an error:
              "@lezer/javascript@*": {
                dependencies: {
                  "@lezer/common": `*`,
                },
              },
            },
          },
        },
      });

      // https://github.com/yarnpkg/berry/pull/5213
      await expect(run(`config`, `get`, `--json`, `packageExtensions`)).rejects.toMatchObject({stdout: expect.stringContaining(`Internal Error: Expected configuration setting "packageExtensions['@lezer/html@*'].dependencies['@lezer/javascript@*']" to be a string, got object`)});
    }));
  });
});
