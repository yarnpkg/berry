import {xfs, ppath, Filename} from '@yarnpkg/fslib';
import {fs, yarn}             from 'pkg-tests-core';

describe(`Commands`, () => {
  describe(`plugin remove`, () => {
    test(
      `it should support removing a plugin via its name`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        // Note: we already know if `plugin import` works, based on the import.test.ts file
        await run(`plugin`, `import`, require.resolve(`@yarnpkg/monorepo/scripts/plugin-hello-world.js`));
        await run(`plugin`, `remove`, `@yarnpkg/plugin-hello-world`);

        const relativePluginPath = yarn.getRelativePluginPath(`@yarnpkg/plugin-hello-world`);

        const absolutePluginPath = ppath.resolve(path, relativePluginPath);
        expect(xfs.existsSync(absolutePluginPath)).toBeFalsy();

        const rcContent = await fs.readSyml(ppath.join(path, Filename.rc));
        expect(rcContent).toHaveProperty(`plugins`);
        expect(rcContent.plugins).toHaveLength(0);
      }),
    );
  });
});
