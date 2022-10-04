import {httpUtils}         from '@yarnpkg/core';
import {npmHttpUtils}      from '@yarnpkg/plugin-npm';

import {makeConfiguration} from './_makeConfiguration';

jest.mock(`@yarnpkg/core`, () => ({
  ...jest.requireActual(`@yarnpkg/core`),
  httpUtils: {
    ...jest.requireActual(`@yarnpkg/core`).httpUtils,
    get: jest.fn(() => Promise.resolve()),
  },
}));

describe(`npmHttpUtils.get`, () => {
  for (const registry of [`https://example.org`, `https://example.org/`, `https://example.org/foo`, `https://example.org/foo/`]) {
    for (const path of [`/bar`]) {
      const expected = registry.replace(/\/+$/, ``) + path;

      it(`should craft the final path correctly (${registry} + ${path} = ${expected})`, async () => {
        const configuration = await makeConfiguration();

        await npmHttpUtils.get(path, {
          configuration,
          registry,
        });

        expect(httpUtils.get).toHaveBeenCalledWith(expected, expect.anything());
      });
    }
  }
});
