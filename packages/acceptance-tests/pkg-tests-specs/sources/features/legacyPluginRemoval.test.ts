import {xfs, ppath, Filename, npath} from '@yarnpkg/fslib';
import {fs, yarn}                    from 'pkg-tests-core';


describe(`Features`, () => {
  describe(`Legacy Plugin Removal`, () => {
    test(
      `it should remove the legacy plugins when running an install`,
      makeTemporaryEnv(
        {},
        async ({path, run, source}) => {
          const helloWorldSource = npath.toPortablePath(require.resolve(`@yarnpkg/monorepo/scripts/plugin-hello-world.js`));
          const fakeTypeScriptPlugin = yarn.getPluginPath(path, `@yarnpkg/plugin-typescript`);

          await xfs.copyPromise(fakeTypeScriptPlugin, helloWorldSource);

          await xfs.writeJsonPromise(ppath.join(path, Filename.rc), {
            plugins: [{
              path: ppath.relative(path, fakeTypeScriptPlugin),
              spec: `@yarnpkg/plugin-typescript`,
            }],
          });

          await run(`install`);

          await expect(xfs.existsPromise(fakeTypeScriptPlugin)).resolves.toEqual(false);

          const data = await fs.readSyml(ppath.join(path, Filename.rc));
          expect(data).toEqual({});
        },
      ),
    );

    test(
      `it shouldn't remove other plugins`,
      makeTemporaryEnv(
        {},
        async ({path, run, source}) => {
          const helloWorldSource = npath.toPortablePath(require.resolve(`@yarnpkg/monorepo/scripts/plugin-hello-world.js`));
          const fakeTypeScriptPlugin = yarn.getPluginPath(path, `@yarnpkg/plugin-typescript`);
          const helloWorldPlugin = yarn.getPluginPath(path, `@yarnpkg/plugin-typescript`);

          await xfs.copyPromise(fakeTypeScriptPlugin, helloWorldSource);
          await xfs.copyPromise(helloWorldPlugin, helloWorldSource);

          await xfs.writeJsonPromise(ppath.join(path, Filename.rc), {
            plugins: [{
              path: ppath.relative(path, fakeTypeScriptPlugin),
              spec: `@yarnpkg/plugin-typescript`,
            }, {
              path: ppath.relative(path, helloWorldPlugin),
              spec: `@yarnpkg/plugin-hello-world`,
            }],
          });

          await run(`install`);

          await expect(xfs.existsPromise(helloWorldPlugin)).resolves.toEqual(false);

          const data = await fs.readSyml(ppath.join(path, Filename.rc));
          expect(data).toEqual({
            plugins: [{
              path: ppath.relative(path, fakeTypeScriptPlugin),
              spec: `@yarnpkg/plugin-hello-world`,
            }],
          });
        },
      ),
    );
  });
});
