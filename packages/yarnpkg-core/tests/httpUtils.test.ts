import {Configuration, Plugin, httpUtils} from '@yarnpkg/core';
import {npath}                            from '@yarnpkg/fslib';
import http                               from 'http';
import {AddressInfo, Socket}              from 'net';
import net                                from 'net';

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
      const sockets = new Set<Socket>();
      let resolveRequest!: () => void;
      const requestReceived = new Promise<void>(resolve => {
        resolveRequest = resolve;
      });

      const server = http.createServer(() => {
        resolveRequest();
      });
      server.on(`connection`, socket => {
        sockets.add(socket);
        socket.on(`close`, () => {
          sockets.delete(socket);
        });
      });

      await new Promise<void>(resolve => {
        server.listen(0, `127.0.0.1`, resolve);
      });

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

        await requestReceived;

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
        await queuedRequest;

        expect(queuedRequestStarted).toBe(true);
      } finally {
        for (const socket of sockets)
          socket.destroy();

        await new Promise<void>(resolve => {
          server.close(() => resolve());
        });
      }
    });

    it(`cancels proxy connections while their tunnel is being established`, async () => {
      const sockets = new Set<Socket>();
      let resolveProxyRequest!: () => void;
      const proxyRequestReceived = new Promise<void>(resolve => {
        resolveProxyRequest = resolve;
      });
      let resolveProxySocketClosed!: () => void;
      const proxySocketClosed = new Promise<void>(resolve => {
        resolveProxySocketClosed = resolve;
      });

      const server = net.createServer(socket => {
        sockets.add(socket);
        socket.once(`data`, () => {
          resolveProxyRequest();
        });
        socket.once(`close`, () => {
          sockets.delete(socket);
          resolveProxySocketClosed();
        });
      });

      await new Promise<void>(resolve => {
        server.listen(0, `127.0.0.1`, resolve);
      });

      try {
        const configuration = Configuration.create(npath.toPortablePath(`.`));
        const {port} = server.address() as AddressInfo;
        configuration.values.set(`httpsProxy`, `http://127.0.0.1:${port}`);
        configuration.values.set(`httpRetry`, 0);

        const abortController = new AbortController();
        const request = httpUtils.request(`https://example.com`, null, {
          configuration,
          signal: abortController.signal,
        });

        await proxyRequestReceived;

        const requestExpectation = expect(request).rejects.toMatchObject({
          name: `CancelError`,
        });

        abortController.abort();

        await requestExpectation;

        let timeout: ReturnType<typeof setTimeout> | undefined;
        try {
          await Promise.race([
            proxySocketClosed,
            new Promise<never>((_resolve, reject) => {
              timeout = setTimeout(() => {
                reject(new Error(`Expected the aborted proxy connection to close`));
              }, 2_000);
            }),
          ]);
        } finally {
          clearTimeout(timeout);
        }
      } finally {
        for (const socket of sockets)
          socket.destroy();

        await new Promise<void>(resolve => {
          server.close(() => resolve());
        });
      }
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
