import {Configuration}            from '@yarnpkg/core';
import {npath, PortablePath, xfs} from '@yarnpkg/fslib';
import {stringifySyml}            from '@yarnpkg/parsers';
import {fs}                       from 'pkg-tests-core';

import {mockPluginServer}         from './plugins.utility';

const COMMANDS_PLUGIN = (name: string, {async = false, printOnBoot = false, thirdParty = false} = {}) => `
const factory = ${async ? `async` : ``} r => {
  const {Command} = r('clipanion');

  if (${printOnBoot})
    console.log('Booting ${name.toUpperCase()}');

  return {
    default: {
      commands: [
        class MyCommand extends Command {
          static paths = [['${name}']];

          async execute() {
            this.context.stdout.write('Executing ${name.toUpperCase()}\\n');
          }
        },
      ],
    },
  };
};

const name = '${thirdParty ? `@thirdParty/plugin-` : `@yarnpkg/plugin-`}${name}';
module.exports = {factory, name};
`;

const CONFIGURATION_PLUGIN = (name: string, {async = false, thirdParty = false} = {}) => `
const factory = ${async ? `async` : ``} r => {
  return {
    default: {
      configuration: {
        foo: {
          description: '',
          type: 'STRING',
          default: '',
        },
        bar: {
          description: '',
          type: 'NUMBER',
          default: 0,
        },
        baz: {
          description: '',
          type: 'BOOLEAN',
          default: false,
        }
      },
    },
  };
};

const name = '${thirdParty ? `@thirdParty/plugin-` : `@yarnpkg/plugin-`}${name}';
module.exports = {factory, name};
`;

describe(`Features`, () => {
  describe(`Plugins`, () => {
    test(`it should properly load a plugin via the local rc file`, makeTemporaryEnv({
    }, async ({path, run, source}) => {
      await xfs.writeFilePromise(`${path}/plugin-a.js` as PortablePath, COMMANDS_PLUGIN(`a`, {printOnBoot: true}));

      await xfs.writeFilePromise(`${path}/.yarnrc.yml` as PortablePath, stringifySyml({
        plugins: [`./plugin-a.js`],
      }));

      await run(`install`);

      await expect(run(`node`, `-e`, ``)).resolves.toMatchObject({
        stdout: `Booting A\nBooting A\n`,
      });
    }));

    test(`it should accept asynchronous plugins`, makeTemporaryEnv({
    }, async ({path, run, source}) => {
      await xfs.writeFilePromise(`${path}/plugin-a.js` as PortablePath, COMMANDS_PLUGIN(`a`, {async: true}));

      await xfs.writeFilePromise(`${path}/.yarnrc.yml` as PortablePath, stringifySyml({
        plugins: [`./plugin-a.js`],
      }));

      await run(`install`);

      await expect(run(`a`)).resolves.toMatchObject({
        stdout: `Executing A\n`,
      });
    }));

    test(`it should properly load multiple plugins via the local rc file, in the right order`, makeTemporaryEnv({
    }, async ({path, run, source}) => {
      await xfs.writeFilePromise(`${path}/plugin-a.js` as PortablePath, COMMANDS_PLUGIN(`A`, {printOnBoot: true}));
      await xfs.writeFilePromise(`${path}/plugin-b.js` as PortablePath, COMMANDS_PLUGIN(`B`, {printOnBoot: true}));

      await xfs.writeFilePromise(`${path}/.yarnrc.yml` as PortablePath, stringifySyml({
        plugins: [`./plugin-a.js`, `./plugin-b.js`],
      }));

      await run(`install`);

      await expect(run(`node`, `-e`, ``)).resolves.toMatchObject({
        stdout: `Booting A\nBooting B\nBooting A\nBooting B\n`,
      });
    }));

    test(`it should be able to define the configuration parameters of official plugins`, makeTemporaryEnv({
    }, async ({path}) => {
      await xfs.writeFilePromise(`${path}/.yarnrc.yml` as PortablePath, stringifySyml({
        plugins: [`./plugin-a.js`],
        foo: `string`,
        bar: 123,
        baz: true,
      }));

      // this way to test plugin, that cannot have require
      const pluginA_String = CONFIGURATION_PLUGIN(`a`);
      await xfs.writeFilePromise(`${path}/plugin-a.js` as PortablePath, pluginA_String);
      const pluginA = require(npath.fromPortablePath(`${path}/plugin-a.js`));

      const configuration = await Configuration.find(path, {
        modules: new Map([[pluginA.name, pluginA]]),
        plugins: new Set([pluginA.name]),
      });

      expect(configuration.get(`foo`)).toBe(`string`);
      expect(configuration.get(`bar`)).toBe(123);
      expect(configuration.get(`baz`)).toBe(true);
    }));

    test(`it should be able to define the configuration parameters of third-party plugins`, makeTemporaryEnv({
    }, async ({path}) => {
      await xfs.writeFilePromise(`${path}/.yarnrc.yml` as PortablePath, stringifySyml({
        plugins: [`./plugin-a.js`],
        foo: `string`,
        bar: 123,
        baz: true,
      }));

      // this way to test plugin, that cannot have require
      const pluginA_String = CONFIGURATION_PLUGIN(`a`, {thirdParty: true});
      await xfs.writeFilePromise(`${path}/plugin-a.js` as PortablePath, pluginA_String);
      const pluginA = require(npath.fromPortablePath(`${path}/plugin-a.js`));

      const configuration = await Configuration.find(path, {
        modules: new Map([[pluginA.name, pluginA]]),
        plugins: new Set([pluginA.name]),
      });

      expect(configuration.get(`foo`)).toBe(`string`);
      expect(configuration.get(`bar`)).toBe(123);
      expect(configuration.get(`baz`)).toBe(true);
    }));

    test(`it should fetch missing plugins`, makeTemporaryEnv(
      {},
      async ({path, run, source}) => {
        await mockPluginServer(async mockServer => {
          const {pluginUrl, httpsCaFilePath} = await mockServer;
          const pluginPath = `.yarn/plugins/@yarnpkg/plugin-mock.cjs`;

          await xfs.writeFilePromise(`${path}/.yarnrc.yml` as PortablePath, stringifySyml({
            httpsCaFilePath,
            plugins: [{
              path: pluginPath,
              spec: pluginUrl,
            }],
          }));

          await run(`install`);

          await expect(await xfs.existsPromise(`${path}/${pluginPath}` as PortablePath)).toEqual(true);
          await expect(fs.readSyml(`${path}/.yarnrc.yml` as PortablePath)).resolves.toEqual({
            httpsCaFilePath,
            plugins: [{
              path: pluginPath,
              spec: pluginUrl,
            }],
          });
        });
      },
    ));

    test(`it should throw an error when fetching the plugin but the checksum does not match`, makeTemporaryEnv(
      {},
      async ({path, run}) => {
        await mockPluginServer(async mockServer => {
          const {pluginUrl, httpsCaFilePath} = await mockServer;
          const pluginPath = `.yarn/plugins/@yarnpkg/plugin-mock.cjs`;

          await xfs.writeFilePromise(`${path}/.yarnrc.yml` as PortablePath, stringifySyml({
            httpsCaFilePath,
            plugins: [{
              path: pluginPath,
              spec: pluginUrl,
              checksum: `I am wrong checksum 123456`,
            }],
          }));

          await expect(run(`install`)).rejects.toThrow();
        });
      },
    ),
    );
  });
});
