import {MessageName, ThrowReport, formatUtils, httpUtils} from '@yarnpkg/core';
import {npmHttpUtils}                                     from '@yarnpkg/plugin-npm';

import {makeConfiguration}                                from './_makeConfiguration';

class InfoReport extends ThrowReport {
  infos: Array<string> = [];

  reportInfo(name: MessageName | null, text: string) {
    this.infos.push(formatUtils.stripAnsi(text));
  }
}

const makeResponse = (statusCode: number, headers: httpUtils.Response[`headers`]): httpUtils.Response => {
  return {body: {}, headers, statusCode};
};

const makeHttpError = (statusCode: number, headers: httpUtils.Response[`headers`]) => {
  const error: Error & {response?: httpUtils.Response} = new Error(`Response code ${statusCode}`);
  error.name = `HTTPError`;
  error.response = makeResponse(statusCode, headers);

  return error;
};

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

describe(`npm-notice`, () => {
  const registry = `https://example.org`;
  const authType = npmHttpUtils.AuthType.NO_AUTH;

  it(`should report the notice sent with a successful response`, async () => {
    const configuration = await makeConfiguration();
    const report = new InfoReport();

    await npmHttpUtils.post(`/foo`, {}, {
      configuration,
      registry,
      authType,
      report,
      wrapNetworkRequest: async () => async () => makeResponse(200, {[`npm-notice`]: `Notice from a success, see https://example.org/success`}),
    });

    expect(report.infos).toEqual([`Registry notice: Notice from a success, see https://example.org/success`]);
  });

  it(`should report the notice sent with a failed response`, async () => {
    const configuration = await makeConfiguration();
    const report = new InfoReport();

    await expect(npmHttpUtils.del(`/foo`, {
      configuration,
      registry,
      authType,
      report,
      wrapNetworkRequest: async () => async () => {
        throw makeHttpError(403, {[`npm-notice`]: `Notice from a failure`});
      },
    })).rejects.toThrow();

    expect(report.infos).toEqual([`Registry notice: Notice from a failure`]);
  });

  it(`should only report a given notice once`, async () => {
    const configuration = await makeConfiguration();
    const report = new InfoReport();

    for (const notice of [`Repeated notice`, `Repeated notice`, `Other notice`, `Repeated notice`]) {
      await npmHttpUtils.put(`/foo`, {}, {
        configuration,
        registry,
        authType,
        report,
        wrapNetworkRequest: async () => async () => makeResponse(200, {[`npm-notice`]: notice}),
      });
    }

    npmHttpUtils.reportNotice({[`npm-notice`]: `Repeated notice`}, {configuration, report});

    expect(report.infos).toEqual([`Registry notice: Repeated notice`, `Registry notice: Other notice`]);
  });

  it(`should strip the control characters from the notice`, async () => {
    const configuration = await makeConfiguration();
    const report = new InfoReport();

    npmHttpUtils.reportNotice({[`npm-notice`]: `Hostile\u009b31m notice\u0085 \u001b[2Kwith\u009b0m \u0007controls\t`}, {configuration, report});
    npmHttpUtils.reportNotice({[`npm-notice`]: `\u009b31m\u009b0m \t`}, {configuration, report});

    expect(report.infos).toEqual([`Registry notice: Hostile notice with controls`]);
  });

  it(`shouldn't report anything when no report is provided`, async () => {
    const configuration = await makeConfiguration();
    const report = new InfoReport();

    await npmHttpUtils.post(`/foo`, {}, {
      configuration,
      registry,
      authType,
      wrapNetworkRequest: async () => async () => makeResponse(200, {[`npm-notice`]: `Notice without a report`}),
    });

    // The notice must not have been marked as reported either
    npmHttpUtils.reportNotice({[`npm-notice`]: `Notice without a report`}, {configuration, report});

    expect(report.infos).toEqual([`Registry notice: Notice without a report`]);
  });

  it(`should leave the notice of an OTP challenge to the OTP prompt`, async () => {
    const configuration = await makeConfiguration();
    const report = new InfoReport();

    const originalIsTestEnv = process.env.YARN_IS_TEST_ENV;
    process.env.YARN_IS_TEST_ENV = `1`;

    let stdout = ``;
    const write = jest.spyOn(process.stdout, `write`).mockImplementation((chunk: any) => {
      stdout += chunk.toString();
      return true;
    });

    try {
      let requestCount = 0;

      await npmHttpUtils.put(`/foo`, {}, {
        configuration,
        registry,
        authType,
        report,
        wrapNetworkRequest: async () => async () => {
          requestCount += 1;

          if (requestCount === 1)
            throw makeHttpError(401, {[`www-authenticate`]: `OTP`, [`npm-notice`]: `Notice from an OTP challenge`});

          return makeResponse(200, {[`npm-notice`]: `Notice from an OTP challenge`});
        },
      });

      expect(requestCount).toBe(2);
    } finally {
      write.mockRestore();

      if (typeof originalIsTestEnv === `undefined`) {
        delete process.env.YARN_IS_TEST_ENV;
      } else {
        process.env.YARN_IS_TEST_ENV = originalIsTestEnv;
      }
    }

    expect(formatUtils.stripAnsi(stdout).split(`Registry notice: Notice from an OTP challenge`)).toHaveLength(2);
    expect(report.infos).toEqual([]);
  });
});
