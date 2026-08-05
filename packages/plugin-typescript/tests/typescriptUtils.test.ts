import {Configuration, Hooks, Plugin, httpUtils, structUtils} from '@yarnpkg/core';
import {PortablePath}                                         from '@yarnpkg/fslib';

import {hasDefinitelyTyped}                                   from '../sources/typescriptUtils';
import plugin                                                 from '../sources';

const requestMock = jest.fn<void, [AbortSignal]>();

const descriptor = structUtils.makeDescriptor(
  structUtils.makeIdent(null, `is-number`),
  `unknown`,
);

const makeConfiguration = (executeRequest: (signal: AbortSignal) => Promise<httpUtils.Response>) => {
  const testPlugin: Plugin<Hooks> = {
    hooks: {
      wrapNetworkRequest: async (_executor, {signal}) => {
        if (typeof signal === `undefined`)
          throw new Error(`Expected the Algolia request to receive an abort signal`);

        requestMock(signal);

        return () => executeRequest(signal);
      },
    },
  };

  return Configuration.create(PortablePath.root, new Map<string, Plugin>([
    [`@yarnpkg/plugin-typescript`, plugin],
    [`test-plugin`, testPlugin],
  ]));
};

const flushPromises = async () => {
  for (let t = 0; t < 10; t++) {
    await Promise.resolve();
  }
};

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  requestMock.mockReset();
});

describe(`typescriptUtils`, () => {
  describe(`hasDefinitelyTyped`, () => {
    it(`aborts the Algolia request when the lookup times out`, async () => {
      jest.useFakeTimers();

      const emitWarning = jest.spyOn(process, `emitWarning`).mockImplementation(() => {});
      const configuration = makeConfiguration(signal => {
        return new Promise((_resolve, reject) => {
          if (signal.aborted) {
            reject(signal.reason);
          } else {
            signal.addEventListener(`abort`, () => {
              reject(signal.reason);
            }, {once: true});
          }
        });
      });

      const result = hasDefinitelyTyped(descriptor, configuration);

      await flushPromises();
      expect(requestMock).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(10_000);

      await expect(result).resolves.toBe(false);
      await flushPromises();

      expect(requestMock).toHaveBeenCalledTimes(1);
      expect(requestMock.mock.calls[0][0].aborted).toBe(true);
      expect(emitWarning).toHaveBeenCalledWith(expect.stringContaining(`Couldn't query Algolia's npm-search index`));
    });

    it(`warns and returns false when all Algolia hosts are unreachable`, async () => {
      const emitWarning = jest.spyOn(process, `emitWarning`).mockImplementation(() => {});
      const configuration = makeConfiguration(async () => {
        throw new Error(`Network unavailable`);
      });

      await expect(hasDefinitelyTyped(descriptor, configuration)).resolves.toBe(false);

      expect(requestMock).toHaveBeenCalledTimes(4);
      expect(emitWarning).toHaveBeenCalledWith(expect.stringContaining(`Couldn't query Algolia's npm-search index`));
    });
  });
});
