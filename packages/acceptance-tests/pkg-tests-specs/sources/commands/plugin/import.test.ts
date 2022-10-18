import {hashUtils}                                 from '@yarnpkg/core';
import {xfs, ppath, Filename, npath, PortablePath} from '@yarnpkg/fslib';
import {stringifySyml}                             from '@yarnpkg/parsers';
import {fs, yarn}                                  from 'pkg-tests-core';

import {createMockPlugin, mockPluginServer}        from '../../features/plugins.utility';

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
            checksum: await hashUtils.checksumFile(helloWorldPlugin),
          }],
        });

        await run(`hello`, `--email`, `postmaster@example.org`);
      }),
    );

    test(
      `it should update plugin's checksum, if it's different`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await mockPluginServer(async mockServer => {
          const mockPluginPath = await createMockPlugin(path);
          const {pluginUrl, httpsCaFilePath} = await mockServer;

          await xfs.writeFilePromise(ppath.join(path, Filename.rc), stringifySyml({
            httpsCaFilePath,
            plugins: [{
              path: mockPluginPath,
              spec: pluginUrl,
              checksum: `I am wrong checksum 123456`,
            }],
          }));

          await run(`plugin`, `import`, pluginUrl);

          await expect(xfs.existsPromise(ppath.join(path, mockPluginPath))).resolves.toEqual(true);
          await expect(fs.readSyml(ppath.join(path, Filename.rc))).resolves.toEqual({
            httpsCaFilePath,
            plugins: [{
              path: mockPluginPath,
              spec: pluginUrl,
              checksum: await hashUtils.checksumFile(ppath.join(path, mockPluginPath)),
            }],
          });
        });
      }),
    );

    test(
      `it should clear the plugin's checksum, if it using \`--no-checksum\` option`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await mockPluginServer(async mockServer => {
          const mockPluginPath = await createMockPlugin(path);
          const {pluginUrl, httpsCaFilePath} = await mockServer;

          await xfs.writeFilePromise(ppath.join(path, Filename.rc), stringifySyml({
            httpsCaFilePath,
            plugins: [{
              path: mockPluginPath,
              spec: pluginUrl,
              checksum: `I am checksum 123456`,
            }],
          }));

          await run(`plugin`, `import`, `--no-checksum`, pluginUrl);

          await expect(xfs.existsPromise(`${path}/${mockPluginPath}` as PortablePath)).resolves.toEqual(true);
          await expect(fs.readSyml(ppath.join(path, Filename.rc))).resolves.toEqual({
            httpsCaFilePath,
            plugins: [{
              path: mockPluginPath,
              spec: pluginUrl,
            }],
          });
        });
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
