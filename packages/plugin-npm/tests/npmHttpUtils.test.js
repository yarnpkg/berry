import {Configuration, httpUtils} from '@berry/core';
import {get}                      from '@berry/plugin-npm/sources/npmHttpUtils';

jest.mock(`@berry/core`, () => ({
  ... require.requireActual(`@berry/core`),
  httpUtils: {
    ... require.requireActual(`@berry/core`).httpUtils,
    get: jest.fn(() => Promise.resolve()),
  },
}));

const makeConfiguration = () => Configuration.find(__dirname, {
  modules: new Map([
    [`@berry/core`, require(`@berry/core`)],
    [`@berry/fslib`, require(`@berry/core`)],
    [`@berry/plugin-npm`, require(`@berry/plugin-npm`)],
  ]),
  plugins: new Set([
    `@berry/plugin-npm`,
  ]),
}, {
  useRc: false,
  strict: false,
});

describe(`npmHttpUtils.get`, () => {
  for (const registry of [`https://example.org`, `https://example.org/`, `https://example.org/foo`, `https://example.org/foo/`]) {
    for (const path of [`/bar`]) {
      const expected = registry.replace(/\/+$/, ``) + path;

      it(`should craft the final path correctly (${registry} + ${path} = ${expected})`, async () => {
        const configuration = await makeConfiguration();

        await get(path, {
          configuration,
          registry,
        });

        expect(httpUtils.get).toHaveBeenCalledWith(expected, expect.anything());
      });
    }
  }
});
