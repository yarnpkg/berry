import {Configuration, Plugin, httpUtils} from '@yarnpkg/core';
import {PortablePath, npath}              from '@yarnpkg/fslib';
import http                               from 'http';
import net                                from 'net';
import {AddressInfo}                      from 'net';

describe(`httpUtils`, () => {
  describe(`request through a proxy`, () => {
    let targetServer: http.Server;
    let proxyServer: http.Server;
    let sockets: Array<net.Socket>;
    let connectCount: number;

    beforeEach(async () => {
      sockets = [];
      connectCount = 0;

      targetServer = http.createServer((req, res) => res.end(`ok`));

      proxyServer = http.createServer();
      proxyServer.on(`connect`, (req: http.IncomingMessage, clientSocket: net.Socket, head: Buffer) => {
        connectCount += 1;
        const [host, port] = (req.url ?? ``).split(`:`);
        const serverSocket = net.connect(Number(port), host, () => {
          clientSocket.write(`HTTP/1.1 200 Connection Established\r\n\r\n`);
          serverSocket.write(head);
          serverSocket.pipe(clientSocket);
          clientSocket.pipe(serverSocket);
        });
        sockets.push(clientSocket, serverSocket);
      });

      await new Promise<void>(resolve => targetServer.listen(0, resolve));
      await new Promise<void>(resolve => proxyServer.listen(0, `127.0.0.1`, resolve));
    });

    afterEach(async () => {
      for (const socket of sockets)
        socket.destroy();

      targetServer.closeAllConnections();
      await Promise.all([targetServer, proxyServer].map(server => new Promise(resolve => server.close(resolve))));
    });

    function getConfiguration(proxyPort: number) {
      const configuration = Configuration.create(npath.toPortablePath(`.`));
      configuration.use(`<test>`, {
        httpProxy: `http://127.0.0.1:${proxyPort}`,
        unsafeHttpWhitelist: [`localhost`],
        networkConcurrency: `1`,
      }, PortablePath.root, {overwrite: true});

      return configuration;
    }

    it(`reuses the proxy tunnel for subsequent requests`, async () => {
      const configuration = getConfiguration((proxyServer.address() as AddressInfo).port);
      const {port} = targetServer.address() as AddressInfo;

      for (let t = 0; t < 3; ++t) {
        const response = await httpUtils.request(`http://localhost:${port}/${t}`, null, {configuration});
        expect(response.body.toString()).toEqual(`ok`);
      }

      expect(connectCount).toEqual(1);
    });
  });

  describe(`request`, () => {
    it(`executes a request to the given target using any registered wrapNetworkRequest plugins`, async () => {
      // Arrange
      const target = `https://my/fake/target`;
      const body = {fake: `body`};

      const {plugins, mockWrapNetworkRequest} = getPluginsWithMockWrapNetworkRequestPlugin();

      const configuration = Configuration.create(npath.toPortablePath(`.`), plugins);
      mockWrapNetworkRequest.mockReturnValue(() => {});

      const headers = {};
      const jsonRequest = true;
      const jsonResponse = true;
      const method = httpUtils.Method.PUT;

      // Act
      await httpUtils.request(target, body, {configuration, headers, jsonRequest, jsonResponse, method});

      // Assert
      expect(mockWrapNetworkRequest.mock.calls.length).toBe(1);
      // mockWrapNetworkRequest.mock.calls[0][0] is supplied implicitly by Configuration.reduceHooks, tested elsewhere presumably
      const hookArgumentResult = mockWrapNetworkRequest.mock.calls[0][1];
      expect(hookArgumentResult.target).toBe(target);
      expect(hookArgumentResult.body).toBe(body);
      expect(hookArgumentResult.configuration).toBe(configuration);
      expect(hookArgumentResult.headers).toBe(headers);
      expect(hookArgumentResult.jsonRequest).toBe(jsonRequest);
      expect(hookArgumentResult.jsonResponse).toBe(jsonResponse);
      expect(hookArgumentResult.method).toBe(method);
    });
  });

  function getPluginsWithMockWrapNetworkRequestPlugin() {
    const mockWrapNetworkRequest = jest.fn();
    const plugins = new Map<string, Plugin<any>>();
    plugins.set(`fakeWrapNetworkRequestPlugin`, {
      hooks: {
        wrapNetworkRequest: mockWrapNetworkRequest,
      },
    });

    return {plugins, mockWrapNetworkRequest};
  }
});
