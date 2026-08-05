import {Configuration, Plugin, httpUtils} from '@yarnpkg/core';
import {npath}                            from '@yarnpkg/fslib';
import events                             from 'events';
import http                               from 'http';
import {AddressInfo, Socket}              from 'net';
import net                                from 'net';
import {setTimeout}                       from 'timers/promises';

describe(`httpUtils`, () => {
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
      const signal = new AbortController().signal;

      // Act
      await httpUtils.request(target, body, {configuration, headers, jsonRequest, jsonResponse, method, signal});

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
      expect(hookArgumentResult.signal).toBe(signal);
    });

    it(`cancels active requests and releases their network concurrency slot`, async () => {
      // Requests are never answered, so they stay active until they get cancelled
      const server = http.createServer(() => {});

      server.listen(0, `127.0.0.1`);
      await events.once(server, `listening`);

      try {
        const configuration = Configuration.create(npath.toPortablePath(`.`));
        configuration.values.set(`httpRetry`, 0);
        configuration.values.set(`networkConcurrency`, 1);
        configuration.values.set(`unsafeHttpWhitelist`, [`127.0.0.1`]);

        const abortController = new AbortController();
        const {port} = server.address() as AddressInfo;
        const request = httpUtils.request(`http://127.0.0.1:${port}`, null, {
          configuration,
          signal: abortController.signal,
        });

        await events.once(server, `request`);

        let queuedRequestStarted = false;
        const queuedRequest = configuration.getLimit(`networkConcurrency`)(async () => {
          queuedRequestStarted = true;
        });

        expect(queuedRequestStarted).toBe(false);

        const requestExpectation = expect(request).rejects.toMatchObject({
          name: `CancelError`,
        });

        abortController.abort();

        await requestExpectation;
        await expectToSettle(queuedRequest, `Expected the cancelled request to release its network concurrency slot`);

        expect(queuedRequestStarted).toBe(true);
      } finally {
        server.closeAllConnections();
        server.close();
        await events.once(server, `close`);
      }
    });

    it(`cancels proxy connections while their tunnel is being established`, async () => {
      // The tunnel is never established, so the proxy connection stays open until
      // it gets cancelled
      const server = net.createServer();

      server.listen(0, `127.0.0.1`);
      await events.once(server, `listening`);

      let proxySocket: Socket | undefined;

      try {
        const configuration = Configuration.create(npath.toPortablePath(`.`));
        const {port} = server.address() as AddressInfo;
        configuration.values.set(`httpsProxy`, `http://127.0.0.1:${port}`);
        configuration.values.set(`httpRetry`, 0);

        const abortController = new AbortController();
        const proxyConnection = events.once(server, `connection`);
        const request = httpUtils.request(`https://example.com`, null, {
          configuration,
          signal: abortController.signal,
        });

        const [socket] = await proxyConnection as [Socket];
        proxySocket = socket;

        await events.once(socket, `data`);

        const proxySocketClosed = events.once(socket, `close`);

        const requestExpectation = expect(request).rejects.toMatchObject({
          name: `CancelError`,
        });

        abortController.abort();

        await requestExpectation;
        await expectToSettle(proxySocketClosed, `Expected the cancelled proxy connection to close`);
      } finally {
        proxySocket?.destroy();
        server.close();
        await events.once(server, `close`);
      }
    });
  });

  // Without this the tests would hang until Jest's own timeout kicks in, which
  // wouldn't tell us which of the expectations actually failed
  async function expectToSettle(promise: Promise<unknown>, message: string) {
    await Promise.race([promise, setTimeout(2_000, undefined, {ref: false}).then(() => {
      throw new Error(message);
    })]);
  }

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
