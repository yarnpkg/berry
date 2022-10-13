import {PortablePath, xfs} from '@yarnpkg/fslib';
import https               from 'https';
import {AddressInfo}       from 'net';
import {tests}             from 'pkg-tests-core';

export const createMockPlugin = async (path: string): Promise<PortablePath> => {
  const helloWorldPluginPath = require.resolve(`@yarnpkg/monorepo/scripts/plugin-hello-world.js`) as PortablePath;
  const helloWorldPlugin = await xfs.readFilePromise(helloWorldPluginPath);
  const mockPluginPath = `.yarn/plugins/@yarnpkg/plugin-hello-world.cjs`;
  await xfs.mkdirPromise(`${path}/.yarn/plugins/@yarnpkg` as PortablePath, {recursive: true});
  await xfs.writeFilePromise(`${path}/${mockPluginPath}` as PortablePath, helloWorldPlugin);
  return mockPluginPath as PortablePath;
};

export const mockPluginServer: (path: PortablePath) => Promise<{pluginUrl: string, httpsCaFilePath: PortablePath}> = async path => {
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
