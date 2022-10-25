import {PortablePath, xfs} from '@yarnpkg/fslib';
import https               from 'https';
import {AddressInfo}       from 'net';
import {tests}             from 'pkg-tests-core';

export async function createMockPlugin(path: string) {
  const helloWorldPluginPath = require.resolve(`@yarnpkg/monorepo/scripts/plugin-hello-world.js`) as PortablePath;
  const helloWorldPlugin = await xfs.readFilePromise(helloWorldPluginPath);
  const mockPluginPath = `.yarn/plugins/@yarnpkg/plugin-hello-world.cjs`;

  await xfs.mkdirPromise(`${path}/.yarn/plugins/@yarnpkg` as PortablePath, {recursive: true});
  await xfs.writeFilePromise(`${path}/${mockPluginPath}` as PortablePath, helloWorldPlugin);

  return mockPluginPath as PortablePath;
}

export async function mockPluginServer(asyncFn: (mockServer: {pluginUrl: string, httpsCaFilePath: PortablePath}) => Promise<void>) {
  const path = await xfs.mktempPromise();
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

  const mockServer = await new Promise<{
    pluginUrl: string;
    httpsCaFilePath: PortablePath;
  }>((resolve, reject) => {
    server.listen(() => {
      const {port} = server.address() as AddressInfo;

      resolve({
        pluginUrl: `https://localhost:${port}`,
        httpsCaFilePath,
      });
    });
  });

  try {
    await asyncFn(mockServer);
  } finally {
    server.close();
  }
}
