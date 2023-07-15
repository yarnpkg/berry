import {npmHttpUtils}      from '@yarnpkg/plugin-npm';

import {makeConfiguration} from './_makeConfiguration';

describe(`npmHttpUtils.get`, () => {
  for (const registry of [`https://example.org`, `https://example.org/`, `https://example.org/foo`, `https://example.org/foo/`]) {
    for (const path of [`/bar`]) {
      const expected = registry.replace(/\/+$/, ``) + path;

      it(`should craft the final path correctly (${registry} + ${path} = ${expected})`, async () => {
        const configuration = await makeConfiguration();

        let actualTarget: string | undefined;
        await npmHttpUtils.get(path, {
          configuration,
          registry,
          async wrapNetworkRequest(executor, extra) {
            actualTarget = extra.target.toString();

            return () => Promise.resolve({body: {}, headers: {}, statusCode: 200});
          },
        });

        expect(actualTarget).toEqual(expected);
      });
    }
  }
});
