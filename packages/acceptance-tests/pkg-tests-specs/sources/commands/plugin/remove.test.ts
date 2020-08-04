import {xfs, ppath, Filename, npath} from '@yarnpkg/fslib';
import {fs, yarn}                    from 'pkg-tests-core';

describe(`Commands`, () => {
  describe(`plugin remove`, () => {
    test(
      `it should support removing a plugin via its name`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const helloWorldSource = require.resolve(`@yarnpkg/monorepo/scripts/plugin-hello-world.js`);
        const helloUniverseSource = require.resolve(`@yarnpkg/monorepo/scripts/plugin-hello-universe.js`);

        // Note: we assume that `plugin import` works, since it has its own tests
        await run(`plugin`, `import`, helloWorldSource);
        await run(`plugin`, `import`, helloUniverseSource);

        const helloWorldPlugin = yarn.getPluginPath(path, `@yarnpkg/plugin-hello-world`);
        const helloUniversePlugin = yarn.getPluginPath(path, `@yarnpkg/plugin-hello-universe`);

        await expect(xfs.existsPromise(helloWorldPlugin)).resolves.toEqual(true);
        await expect(fs.readSyml(ppath.join(path, Filename.rc))).resolves.toEqual({
          plugins: [{
            path: ppath.relative(path, helloWorldPlugin),
            spec: ppath.relative(path, npath.toPortablePath(helloWorldSource)),
          }, {
            path: ppath.relative(path, helloUniversePlugin),
            spec: ppath.relative(path, npath.toPortablePath(helloUniverseSource)),
          }],
        });

        await run(`plugin`, `remove`, `@yarnpkg/plugin-hello-world`);

        await expect(xfs.existsPromise(helloWorldPlugin)).resolves.toEqual(false);
        await expect(fs.readSyml(ppath.join(path, Filename.rc))).resolves.toEqual({
          plugins: [{
            path: ppath.relative(path, helloUniversePlugin),
            spec: ppath.relative(path, npath.toPortablePath(helloUniverseSource)),
          }],
        });
      }),
    );

    test(
      `it should completely remove the key when removing the last plugin`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const helloWorldSource = require.resolve(`@yarnpkg/monorepo/scripts/plugin-hello-world.js`);

        await run(`plugin`, `import`, helloWorldSource);
        await run(`plugin`, `remove`, `@yarnpkg/plugin-hello-world`);

        const helloWorldPlugin = yarn.getPluginPath(path, `@yarnpkg/plugin-hello-world`);
        expect(xfs.existsSync(helloWorldPlugin)).toBeFalsy();

        const rcContent = await fs.readSyml(ppath.join(path, Filename.rc));
        expect(rcContent).not.toHaveProperty(`plugins`);
      }),
    );
  });
});
