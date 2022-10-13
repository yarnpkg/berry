import {hashUtils}                          from '@yarnpkg/core';
import {xfs, PortablePath}                  from '@yarnpkg/fslib';

import {createMockPlugin, mockPluginServer} from '../../features/plugins.utility';

describe(`Commands`, () => {
  describe(`plugin check`, () => {
    test(
      `it should run successfully and do nothing`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await mockPluginServer(async mockServer => {
          const mockPluginPath = await createMockPlugin(path);
          const {pluginUrl, httpsCaFilePath} = mockServer;

          await xfs.writeJsonPromise(`${path}/.yarnrc.yml` as PortablePath, {
            httpsCaFilePath,
            plugins: [{
              path: mockPluginPath,
              spec: pluginUrl,
              checksum: await hashUtils.checksumFile(`${path}/${mockPluginPath}` as PortablePath),
            }],
          });

          await expect(run(`plugin`, `check`)).resolves.toMatchSnapshot();
        });
      }),
    );

    test(
      `it should print out the plugin when it has a different checksum`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await mockPluginServer(async mockServer => {
          const mockPluginPath = await createMockPlugin(path);
          const {pluginUrl, httpsCaFilePath} = mockServer;

          await xfs.writeJsonPromise(`${path}/.yarnrc.yml` as PortablePath, {
            httpsCaFilePath,
            plugins: [{
              path: mockPluginPath,
              spec: pluginUrl,
              checksum: `I am wrong checksum 123456`,
            }],
          });

          await expect(run(`plugin`, `check`)).rejects.toThrow(/is different/);
        });
      }),
    );
  });
});
