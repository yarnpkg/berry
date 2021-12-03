import {Configuration, Plugin} from '@yarnpkg/core';
import {npath}                 from '@yarnpkg/fslib';
import got                     from 'got';

import * as httpUtils          from '../sources/httpUtils';
import {Method}                from '../sources/httpUtils';

jest.mock(`got`, () => ({
  extend: jest.fn(),
}));

const mockExtend = got.extend as jest.Mock;
const mockClient = jest.fn();

describe(`httpUtils`, () => {
  beforeEach(() => {
    mockExtend.mockReset();
    mockExtend.mockReturnValue(mockClient);
  });

  describe(`request`, () => {
    it(`executes a request to the given target`, async () => {
      // Arrange
      const target = `https://my/fake/target`;
      const body = {fake: `body`};
      const configuration = Configuration.create(npath.toPortablePath(`.`));
      const expectedResponse = {};
      mockClient.mockReturnValue(expectedResponse);

      // Act
      const response = await httpUtils.request(target, body, {configuration});

      // Assert
      expect(mockExtend.mock.calls.length).toBe(1);
      expect(mockClient.mock.calls.length).toBe(1);
      expect(mockClient.mock.calls[0][0].href).toBe(target);
      expect(response).toEqual(expectedResponse);
    });

    it(`executes a request to the given target using any registered wrapNetworkRequest plugins`, async () => {
      // Arrange
      const target = `https://my/fake/target`;
      const body = {fake: `body`};

      const {plugins, mockWrapNetworkRequest} = getPluginsWithMockWrapNetworkRequestPlugin();

      const configuration = Configuration.create(npath.toPortablePath(`.`), plugins);
      const expectedResponse = {};
      mockClient.mockReturnValue(expectedResponse);

      const headers = {};
      const jsonRequest = true;
      const jsonResponse = true;
      const method = Method.PUT;

      // Act
      await httpUtils.request(target, body, {configuration, headers, jsonRequest, jsonResponse, method});

      // Assert
      expect(mockWrapNetworkRequest.mock.calls.length).toBe(1);
      // mockWrapNetworkRequest.mock.calls[0][0] is supplied implicitly by Configuration.reduceHooks, tested elsewhere presumedly
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
    mockWrapNetworkRequest.mockImplementation(async () => async () => {});
    const plugins = new Map<string, Plugin<any>>();
    plugins.set(`fakeWrapNetworkRequestPlugin`, {
      hooks: {
        wrapNetworkRequest: mockWrapNetworkRequest,
      },
    });

    return {plugins, mockWrapNetworkRequest};
  }
});
