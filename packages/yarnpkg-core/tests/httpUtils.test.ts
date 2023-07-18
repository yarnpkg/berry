import {Configuration, Plugin, httpUtils} from '@yarnpkg/core';
import {npath}                            from '@yarnpkg/fslib';

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
