import {Configuration, httpUtils} from '@yarnpkg/core';
import {get}                      from '@yarnpkg/plugin-npm/sources/npmHttpUtils';

jest.mock(`@yarnpkg/core`, () => ({
  ... require.requireActual(`@yarnpkg/core`),
  httpUtils: {
    ... require.requireActual(`@yarnpkg/core`).httpUtils,
    get: jest.fn(() => Promise.resolve()),
  },
}));

const makeConfiguration = () => Configuration.find(__dirname, {
  modules: new Map([
    [`@yarnpkg/core`, require(`@yarnpkg/core`)],
    [`@yarnpkg/fslib`, require(`@yarnpkg/core`)],
    [`@yarnpkg/plugin-npm`, require(`@yarnpkg/plugin-npm`)],
  ]),
  plugins: new Set([
    `@yarnpkg/plugin-npm`,
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
