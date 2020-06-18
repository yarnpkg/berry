import {xfs, ppath, Filename} from '@yarnpkg/fslib';
import {fs, yarn}             from 'pkg-tests-core';

describe(`Commands`, () => {
  describe(`plugin import`, () => {
    test(
      `it should support adding a plugin via its path`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await run(`plugin`, `import`, require.resolve(`@yarnpkg/monorepo/scripts/plugin-hello-world.js`));

        const relativePluginPath = yarn.getRelativePluginPath(`@yarnpkg/plugin-hello-world`);

        const absolutePluginPath = ppath.resolve(path, relativePluginPath);
        expect(xfs.existsSync(absolutePluginPath)).toBeTruthy();

        const rcContent = await fs.readSyml(ppath.join(path, Filename.rc));
        expect(rcContent).toHaveProperty(`plugins`);
        expect(rcContent.plugins).toContainEqual(expect.objectContaining({
          path: relativePluginPath,
        }));

        await expect(
          () => run(`hello`, `--email`, `postmaster@example.org`)
        ).not.toThrow();
      }),
    );
  });
});
