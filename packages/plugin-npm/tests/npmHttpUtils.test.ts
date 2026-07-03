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

describe(`npmHttpUtils.put`, () => {
  it(`shouldn't ask for an OTP when stdin isn't a TTY`, async () => {
    const configuration = await makeConfiguration();

    const originalIsTestEnv = process.env.YARN_IS_TEST_ENV;
    const originalIsTTY = process.stdin.isTTY;

    process.env.YARN_IS_TEST_ENV = ``;
    Object.defineProperty(process.stdin, `isTTY`, {
      configurable: true,
      value: false,
    });

    try {
      let requestCount = 0;

      await expect(npmHttpUtils.put(`/foo`, {}, {
        configuration,
        registry: `https://example.org`,
        authType: npmHttpUtils.AuthType.NO_AUTH,
        async wrapNetworkRequest() {
          return async () => {
            requestCount += 1;

            const error: Error & {response?: any} = new Error(`OTP required`);
            error.name = `HTTPError`;
            error.response = {
              body: {
                error: `OTP required`,
              },
              headers: {
                [`www-authenticate`]: `OTP`,
              },
              statusCode: 401,
            };

            throw error;
          };
        },
      })).rejects.toThrow(/The registry requires additional authentication, but Yarn is not running in an interactive terminal/);

      expect(requestCount).toBe(1);
    } finally {
      if (typeof originalIsTestEnv === `undefined`)
        delete process.env.YARN_IS_TEST_ENV;
      else
        process.env.YARN_IS_TEST_ENV = originalIsTestEnv;

      Object.defineProperty(process.stdin, `isTTY`, {
        configurable: true,
        value: originalIsTTY,
      });
    }
  });
});
