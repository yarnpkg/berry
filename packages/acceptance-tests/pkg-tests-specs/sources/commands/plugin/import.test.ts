import {xfs, ppath, Filename, npath} from '@yarnpkg/fslib';
import {fs, yarn}                    from 'pkg-tests-core';

describe(`Commands`, () => {
  describe(`plugin import`, () => {
    test(
      `it should support adding a plugin via its path`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const helloWorldSource = require.resolve(`@yarnpkg/monorepo/scripts/plugin-hello-world.js`);

        await run(`plugin`, `import`, helloWorldSource);

        const helloWorldPlugin = yarn.getPluginPath(path, `@yarnpkg/plugin-hello-world`);
        await expect(xfs.existsPromise(helloWorldPlugin)).resolves.toEqual(true);

        await expect(fs.readSyml(ppath.join(path, Filename.rc))).resolves.toEqual({
          plugins: [{
            path: ppath.relative(path, helloWorldPlugin),
            spec: ppath.relative(path, npath.toPortablePath(helloWorldSource)),
          }],
        });

        await run(`hello`, `--email`, `postmaster@example.org`);
      }),
    );

    test(
      `it should detect attempts to import built-in plugins`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await expect(run(`plugin`, `import`, `workspace-tools`)).rejects.toMatchObject({
          code: 1,
          stdout: expect.stringContaining(`is already installed`),
        });
      }),
    );
  });
});
