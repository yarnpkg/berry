import {Filename, ppath, xfs} from '@yarnpkg/fslib';

describe(`Features`, () => {
  describe(`Configuration`, () => {
    test(`it should override RC files w/ environment values`, makeTemporaryEnv({
    }, async ({path, run, source}) => {
      await xfs.writeJsonPromise(ppath.join(path, Filename.rc), {
        preferInteractive: true,
      });

      await expect(run(`config`, `get`, `--json`, `preferInteractive`)).resolves.toMatchObject({
        stdout: `true\n`,
      });

      await expect(run(`config`, `get`, `--json`, `preferInteractive`, {
        env: {YARN_PREFER_INTERACTIVE: `0`},
      })).resolves.toMatchObject({
        stdout: `false\n`,
      });
    }));
  });
});
