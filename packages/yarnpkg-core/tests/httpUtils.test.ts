import {Configuration, Plugin, YarnVersion, httpUtils} from '@yarnpkg/core';
import {npath}                                         from '@yarnpkg/fslib';
import {once}                                          from 'events';
import {createServer}                                  from 'http';

import {version as coreVersion}                        from '../package.json';

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

      // Act
      await httpUtils.request(target, body, {configuration, headers, jsonRequest, jsonResponse, method});

      // Assert
      expect(mockWrapNetworkRequest.mock.calls.length).toBe(1);
      // mockWrapNetworkRequest.mock.calls[0][0] is supplied implicitly by Configuration.reduceHooks, tested elsewhere presumably
      const hookArgumentResult = mockWrapNetworkRequest.mock.calls[0][1];
      expect(hookArgumentResult.target).toBe(target);
      expect(hookArgumentResult.body).toBe(body);
      expect(hookArgumentResult.configuration).toBe(configuration);
      expect(hookArgumentResult.headers).toEqual({
        ...headers,
        [`user-agent`]: expect.stringMatching(new RegExp(`^yarn/.+ node/${process.version}$`)),
      });
      expect(hookArgumentResult.jsonRequest).toBe(jsonRequest);
      expect(hookArgumentResult.jsonResponse).toBe(jsonResponse);
      expect(hookArgumentResult.method).toBe(method);
    });

    it(`sets a Yarn User-Agent header by default`, async () => {
      // Arrange
      const target = `https://my/fake/target`;

      const {plugins, mockWrapNetworkRequest} = getPluginsWithMockWrapNetworkRequestPlugin();
      const configuration = Configuration.create(npath.toPortablePath(`.`), plugins);
      mockWrapNetworkRequest.mockReturnValue(() => {});

      // Act
      await httpUtils.request(target, null, {configuration});

      // Assert
      const hookArgumentResult = mockWrapNetworkRequest.mock.calls[0][1];
      expect(hookArgumentResult.headers).toEqual({
        [`user-agent`]: expect.stringMatching(new RegExp(`^yarn/.+ node/${process.version}$`)),
      });
    });

    it(`preserves a custom User-Agent header`, async () => {
      // Arrange
      const target = `https://my/fake/target`;

      const {plugins, mockWrapNetworkRequest} = getPluginsWithMockWrapNetworkRequestPlugin();
      const configuration = Configuration.create(npath.toPortablePath(`.`), plugins);
      mockWrapNetworkRequest.mockReturnValue(() => {});

      // Act
      await httpUtils.request(target, null, {
        configuration,
        headers: {
          [`User-Agent`]: `custom-user-agent`,
        },
      });

      // Assert
      const hookArgumentResult = mockWrapNetworkRequest.mock.calls[0][1];
      expect(hookArgumentResult.headers).toEqual({
        [`User-Agent`]: `custom-user-agent`,
      });
    });
  });

  describe(`outgoing User-Agent`, () => {
    const defaultUserAgent = `yarn/${YarnVersion ?? `${coreVersion}-core`} node/${process.version}`;

    it.each([
      {headers: undefined, expected: defaultUserAgent},
      {headers: {}, expected: defaultUserAgent},
      {headers: {[`user-agent`]: undefined}, expected: defaultUserAgent},
      {headers: {[`User-Agent`]: undefined}, expected: defaultUserAgent},
      {headers: {[`USER-AGENT`]: undefined}, expected: defaultUserAgent},
      {headers: {[`user-agent`]: `custom-agent`}, expected: `custom-agent`},
      {headers: {[`User-Agent`]: `custom-agent`}, expected: `custom-agent`},
      {headers: {[`USER-AGENT`]: `custom-agent`}, expected: `custom-agent`},
      {headers: {[`User-Agent`]: undefined, [`user-agent`]: `custom-agent`}, expected: `custom-agent`},
      {headers: {[`user-agent`]: `custom-agent`, [`User-Agent`]: undefined}, expected: `custom-agent`},
    ])(`sends $expected with headers $headers`, async ({headers, expected}) => {
      const server = createServer((request, response) => {
        response.end(request.headers[`user-agent`] ?? ``);
      });

      server.listen(0, `127.0.0.1`);
      await once(server, `listening`);

      try {
        const address = server.address();
        if (address === null || typeof address === `string`)
          throw new Error(`Expected a TCP server address`);

        const configuration = Configuration.create(npath.toPortablePath(`.`));
        configuration.use(`<test>`, {unsafeHttpWhitelist: [`127.0.0.1`]}, npath.toPortablePath(`.`));

        const response = await httpUtils.request(`http://127.0.0.1:${address.port}`, null, {configuration, headers});

        expect(response.body.toString()).toBe(expected);
      } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve, reject) => {
          server.close(error => error ? reject(error) : resolve());
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
