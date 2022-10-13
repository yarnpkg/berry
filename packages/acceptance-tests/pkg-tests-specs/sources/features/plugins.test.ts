import {hashUtils}         from '@yarnpkg/core';
import {PortablePath, xfs} from '@yarnpkg/fslib';
import {stringifySyml}     from '@yarnpkg/parsers';
import https               from 'https';
import {AddressInfo}       from 'net';
import {tests, fs}         from 'pkg-tests-core';

const mockPluginServer: (path: PortablePath) => Promise<{pluginUrl: string, httpsCaFilePath: PortablePath}> = async path => {
  return new Promise((resolve, reject) => {
    (async () => {
      const certs = await tests.getHttpsCertificates();
      const httpsCaFilePath = `${path}/rootCA.crt` as PortablePath;
      await xfs.writeFilePromise(httpsCaFilePath, certs.ca.certificate);

      const helloWorldPluginPath = require.resolve(`@yarnpkg/monorepo/scripts/plugin-hello-world.js`) as PortablePath;
      const helloWorldPlugin = await xfs.readFilePromise(helloWorldPluginPath);
      const server = https.createServer({
        cert: certs.server.certificate,
        key: certs.server.clientKey,
        ca: certs.ca.certificate,
      }, (req, res) => {
        res.writeHead(200);
        res.end(helloWorldPlugin);
      });

      server.unref();
      server.listen(() => {
        const {port} = server.address() as AddressInfo;
        resolve({pluginUrl: `https://localhost:${port}`, httpsCaFilePath});
      });
    })();
  });
};

const PLUGIN = (name: string, {async = false, printOnBoot = false} = {}) => `
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

const name = '@yarnpkg/plugin-${name}';
module.exports = {factory, name};
`;

describe(`Features`, () => {
  describe(`Plugins`, () => {
    test(`it should properly load a plugin via the local rc file`, makeTemporaryEnv({
    }, async ({path, run, source}) => {
      await xfs.writeFilePromise(`${path}/plugin-a.js` as PortablePath, PLUGIN(`a`, {printOnBoot: true}));

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
      await xfs.writeFilePromise(`${path}/plugin-a.js` as PortablePath, PLUGIN(`a`, {async: true}));

      await xfs.writeFilePromise(`${path}/.yarnrc.yml` as PortablePath, stringifySyml({
        plugins: [`./plugin-a.js`],
      }));

      await run(`install`);

      await expect(run(`a`)).resolves.toMatchObject({
        stdout: `Executing A\n`,
      });
    }));

    test(`it should properly load a plugin via the local rc file`, makeTemporaryEnv({
    }, async ({path, run, source}) => {
      await xfs.writeFilePromise(`${path}/plugin-a.js` as PortablePath, PLUGIN(`A`, {printOnBoot: true}));

      await xfs.writeFilePromise(`${path}/.yarnrc.yml` as PortablePath, stringifySyml({
        plugins: [`./plugin-a.js`],
      }));

      await run(`install`);

      await expect(run(`node`, `-e`, ``)).resolves.toMatchObject({
        stdout: `Booting A\nBooting A\n`,
      });
    }));

    test(`it should properly load multiple plugins via the local rc file, in the right order`, makeTemporaryEnv({
    }, async ({path, run, source}) => {
      await xfs.writeFilePromise(`${path}/plugin-a.js` as PortablePath, PLUGIN(`A`, {printOnBoot: true}));
      await xfs.writeFilePromise(`${path}/plugin-b.js` as PortablePath, PLUGIN(`B`, {printOnBoot: true}));

      await xfs.writeFilePromise(`${path}/.yarnrc.yml` as PortablePath, stringifySyml({
        plugins: [`./plugin-a.js`, `./plugin-b.js`],
      }));

      await run(`install`);

      await expect(run(`node`, `-e`, ``)).resolves.toMatchObject({
        stdout: `Booting A\nBooting B\nBooting A\nBooting B\n`,
      });
    }));

    test(`it should fetch missing plugins`, makeTemporaryEnv(
      {},
      async ({path, run, source}) => {
        const {pluginUrl, httpsCaFilePath} = await mockPluginServer(path);
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
            checksum: await hashUtils.checksumFile(`${path}/${pluginPath}` as PortablePath),
          }],
        });
      },
    ),
    );
  });
});
