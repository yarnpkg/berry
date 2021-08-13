import {Filename, npath, PortablePath, ppath, xfs} from '@yarnpkg/fslib';

describe(`Commands`, () => {
  describe(`exec`, () => {
    test(
      `it should preserve the exit code`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await run(`install`);
        await expect(run(`exec`, `run`, `foo`)).rejects.toMatchObject({
          code: 1,
          stdout: expect.stringContaining(`Usage Error: Couldn't find a script named "foo"`),
        });
      }),
    );

    test(
      `it should allow running shell scripts`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await run(`install`);
        await expect(run(`exec`, `echo $(pwd)/package.json`)).resolves.toMatchObject({
          code: 0,
          stdout: `${npath.fromPortablePath(path)}/package.json\n`,
        });
      }),
    );

    test(
      `it should inject binaries the workspace has access to`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await xfs.mkdirPromise(ppath.join(path, `bin` as Filename));
        await xfs.writeFilePromise(ppath.join(path, `bin/index.js` as PortablePath), `console.log(42)`);
        await xfs.writeJsonPromise(ppath.join(path, `bin` as Filename, Filename.manifest), {
          name: `bin`,
          bin: `./index.js`,
        });

        await xfs.writeJsonPromise(ppath.join(path, Filename.manifest), {
          dependencies: {
            bin: `portal:./bin`,
          },
        });

        await run(`install`);

        await expect(run(`exec`, `bin`)).resolves.toMatchObject({
          code: 0,
          stdout: `42\n`,
        });
      }),
    );
  });
});
