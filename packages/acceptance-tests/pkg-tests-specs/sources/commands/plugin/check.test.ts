import {hashUtils}                          from '@yarnpkg/core';
import {xfs, PortablePath}                  from '@yarnpkg/fslib';
import {stringifySyml}                      from '@yarnpkg/parsers';

import {createMockPlugin, mockPluginServer} from '../../features/plugins.utility';

describe(`Commands`, () => {
  describe(`plugin import`, () => {
    test(
      `it should run successfully and do nothing`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const mockPluginPath = await createMockPlugin(path);
        const {pluginUrl, httpsCaFilePath} = await mockPluginServer(path);
        await xfs.writeFilePromise(`${path}/.yarnrc.yml` as PortablePath, stringifySyml({
          httpsCaFilePath,
          plugins: [{
            path: mockPluginPath,
            spec: pluginUrl,
            checksum: hashUtils.checksumFile(`${path}/${mockPluginPath}` as PortablePath),
          }],
        }));
        await expect(
          run(`plugin`, `check`),
        ).resolves.toMatchSnapshot();
      }),
    );

    test(
      `it should print out the plugin when it has a different checksum`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const mockPluginPath = await createMockPlugin(path);
        const {pluginUrl, httpsCaFilePath} = await mockPluginServer(path);
        await xfs.writeFilePromise(`${path}/.yarnrc.yml` as PortablePath, stringifySyml({
          httpsCaFilePath,
          plugins: [{
            path: mockPluginPath,
            spec: pluginUrl,
            checksum: `I am wrong checksum 123456`,
          }],
        }));

        const {code, stdout} = await run(`plugin`, `check`);
        expect(code).toEqual(0);
        expect(stdout.match(/is different/g)).not.toBeNull();
      }),
    );

    test(
      `it should throw an error when it finds some plugins in the CI environment that have a different checksum`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const mockPluginPath = await createMockPlugin(path);
        const {pluginUrl, httpsCaFilePath} = await mockPluginServer(path);
        await xfs.writeFilePromise(`${path}/.yarnrc.yml` as PortablePath, stringifySyml({
          httpsCaFilePath,
          plugins: [{
            path: mockPluginPath,
            spec: pluginUrl,
            checksum: `I am wrong checksum 123456`,
          }],
        }));

        await expect(
          run(`plugin`, `check`, {env: {CI: `1`}}),
        ).rejects.toThrow();
      }),
    );
  });
});
