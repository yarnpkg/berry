import {xfs, PortablePath}     from '@yarnpkg/fslib';
import NpmPlugin               from '@yarnpkg/plugin-npm';

import {Configuration, SECRET} from '../sources/Configuration';

async function initializeConfiguration<T>(value: {[key: string]: any}, cb: (dir: PortablePath) => Promise<T>) {
  return await xfs.mktempPromise(async dir => {
    await Configuration.updateConfiguration(dir, value);

    return await cb(dir);
  });
}

describe(`Configuration`, () => {
  it(`should hide secrets`, async () => {
    await initializeConfiguration({
      npmAuthToken: `my-token`,
      npmScopes: {
        myScope: {
          npmAuthToken: `my-token`,
        },
      },
    }, async dir => {
      const configuration = await Configuration.find(dir, {
        modules: new Map([[`@yarnpkg/plugin-npm`, NpmPlugin]]),
        plugins: new Set([`@yarnpkg/plugin-npm`]),
      });

      const firstToken = configuration.getSpecial(`npmAuthToken`, {
        hideSecrets: true,
      });

      const secondToken = configuration.getSpecial(`npmScopes`, {
        hideSecrets: true,
      }).get(`myScope`).get(`npmAuthToken`);

      expect(firstToken).toEqual(SECRET);
      expect(secondToken).toEqual(SECRET);
    });
  });

  describe(`Environment variables`, () => {
    it(`should replace env variables`, async () => {
      process.env.ENV_AUTH_TOKEN = `AAA-BBB-CCC`;
      process.env.EMPTY_VARIABLE = ``;

      await initializeConfiguration({
        npmScopes: {
          onlyEnv: {
            npmAuthToken: `\${ENV_AUTH_TOKEN}`,
          },
          multipleEnvs: {
            npmAuthToken: `\${ENV_AUTH_TOKEN}-separator-\${ENV_AUTH_TOKEN}`,
          },
          envInString: {
            npmAuthToken: `beforeEnv-\${ENV_AUTH_TOKEN}-after-env`,
          },
          envSetWithFallback: {
            npmAuthToken: `\${ENV_AUTH_TOKEN-fallback-value}`,
          },
          unsetEnvWithFallback: {
            npmAuthToken: `\${NOT_EXISTING_ENV-fallback-value}`,
          },
          unsetEnvWithEmptyFallback: {
            npmAuthToken: `\${NOT_EXISTING_ENV-}`,
          },
          emptyEnvWithStrictFallback: {
            npmAuthToken: `\${EMPTY_VARIABLE-fallback-value}`,
          },
          emptyEnvWithFallback: {
            npmAuthToken: `\${EMPTY_VARIABLE:-fallback-for-empty-value}`,
          },
          emptyEnvWithEmptyFallback: {
            npmAuthToken: `\${EMPTY_VARIABLE:-}`,
          },
        },
      }, async dir => {
        const configuration = await Configuration.find(dir, {
          modules: new Map([[`@yarnpkg/plugin-npm`, NpmPlugin]]),
          plugins: new Set([`@yarnpkg/plugin-npm`]),
        });

        const getToken = (scope: string) => configuration.get(`npmScopes`).get(scope)!.get(`npmAuthToken`);

        const onlyEnv = getToken(`onlyEnv`);
        const multipleEnvs = getToken(`multipleEnvs`);
        const envInString = getToken(`envInString`);
        const envSetWithFallback = getToken(`envSetWithFallback`);
        const unsetEnvWithFallback = getToken(`unsetEnvWithFallback`);
        const unsetEnvWithEmptyFallback = getToken(`unsetEnvWithEmptyFallback`);
        const emptyEnvWithStrictFallback = getToken(`emptyEnvWithStrictFallback`);
        const emptyEnvWithFallback = getToken(`emptyEnvWithFallback`);
        const emptyEnvWithEmptyFallback = getToken(`emptyEnvWithEmptyFallback`);

        expect(onlyEnv).toEqual(`AAA-BBB-CCC`);
        expect(multipleEnvs).toEqual(`AAA-BBB-CCC-separator-AAA-BBB-CCC`);
        expect(envInString).toEqual(`beforeEnv-AAA-BBB-CCC-after-env`);
        expect(envSetWithFallback).toEqual(`AAA-BBB-CCC`);
        expect(unsetEnvWithFallback).toEqual(`fallback-value`);
        expect(unsetEnvWithEmptyFallback).toEqual(``);
        expect(emptyEnvWithStrictFallback).toEqual(``);
        expect(emptyEnvWithFallback).toEqual(`fallback-for-empty-value`);
        expect(emptyEnvWithEmptyFallback).toEqual(``);
      });
    });

    it(`should forbid unset variables`, async () => {
      await initializeConfiguration({
        npmScopes: {
          onlyEnv: {
            npmAuthToken: `\${A_VARIABLE_THAT_DEFINITELY_DOESNT_EXIST}`,
          },
        },
      }, async dir => {
        await expect(Configuration.find(dir, {
          modules: new Map([[`@yarnpkg/plugin-npm`, NpmPlugin]]),
          plugins: new Set([`@yarnpkg/plugin-npm`]),
        })).rejects.toThrow();
      });
    });

    it(`should handle boolean variables correctly`, async () => {
      process.env.TRUE_VARIABLE = `true`;
      process.env.FALSE_VARIABLE = `false`;

      process.env.ONE_VARIABLE = `1`;
      process.env.ZERO_VARIABLE = `0`;

      await initializeConfiguration({
        npmScopes: {
          true: {
            npmAlwaysAuth: `\${TRUE_VARIABLE}`,
          },
          false: {
            npmAlwaysAuth: `\${FALSE_VARIABLE}`,
          },

          one: {
            npmAlwaysAuth: `\${ONE_VARIABLE}`,
          },
          zero: {
            npmAlwaysAuth: `\${ZERO_VARIABLE}`,
          },

          defaultTrue: {
            npmAlwaysAuth: `\${NOT_EXISTING_ENV-true}`,
          },
          defaultFalse: {
            npmAlwaysAuth: `\${NOT_EXISTING_ENV-false}`,
          },
        },
      }, async dir => {
        const configuration = await Configuration.find(dir, {
          modules: new Map([[`@yarnpkg/plugin-npm`, NpmPlugin]]),
          plugins: new Set([`@yarnpkg/plugin-npm`]),
        });

        const getAlwaysAuth = (scope: string) => configuration.get(`npmScopes`).get(scope)!.get(`npmAlwaysAuth`);

        expect(getAlwaysAuth(`true`)).toEqual(true);
        expect(getAlwaysAuth(`false`)).toEqual(false);

        expect(getAlwaysAuth(`one`)).toEqual(true);
        expect(getAlwaysAuth(`zero`)).toEqual(false);

        expect(getAlwaysAuth(`defaultTrue`)).toEqual(true);
        expect(getAlwaysAuth(`defaultFalse`)).toEqual(false);
      });
    });
  });

  describe(`merging properties`, () => {
    it(`should merge map properties`, async () => {
      await initializeConfiguration({
        npmRegistryServer: `https://foo.server`,
        npmScopes: {
          foo: {
            npmAuthToken: `token for foo`,
          },
        },
      }, async dir => {
        const configuration = await Configuration.find(dir, {
          modules: new Map([[`@yarnpkg/plugin-npm`, NpmPlugin]]),
          plugins: new Set([`@yarnpkg/plugin-npm`]),
        });

        configuration.useWithSource(`second file`, {
          npmRegistryServer: `http://bar.server`,
          npmScopes: {
            foo: {
              npmAlwaysAuth: true,
            },
            bar: {
              npmAlwaysAuth: true,
            },
          },
        }, dir);

        expect(configuration.get(`npmRegistryServer`)).toBe(`https://foo.server`);

        const scopeConfiguration = configuration.get(`npmScopes`);
        expect(scopeConfiguration.get(`foo`)?.get(`npmAuthToken`)).toBe(`token for foo`);
        expect(scopeConfiguration.get(`foo`)?.get(`npmAlwaysAuth`)).toBe(false);

        expect(scopeConfiguration.get(`bar`)?.get(`npmAlwaysAuth`)).toBe(true);
      });
    });

    it(`should overwrite map properties`, async () => {
      await initializeConfiguration({
        npmRegistryServer: `https://foo.server`,
        npmScopes: {
          foo: {
            npmAuthToken: `token for foo`,
          },
        },
      }, async dir => {
        const configuration = await Configuration.find(dir, {
          modules: new Map([[`@yarnpkg/plugin-npm`, NpmPlugin]]),
          plugins: new Set([`@yarnpkg/plugin-npm`]),
        });

        configuration.useWithSource(`second file`, {
          npmRegistryServer: `http://bar.server`,
          npmScopes: {
            foo: {
              npmAlwaysAuth: true,
            },
            bar: {
              npmAlwaysAuth: true,
            },
          },
        }, dir, {overwrite: true});

        expect(configuration.get(`npmRegistryServer`)).toBe(`http://bar.server`);

        const scopeConfiguration = configuration.get(`npmScopes`);
        expect(scopeConfiguration.get(`foo`)?.get(`npmAuthToken`)).toBe(null);
        expect(scopeConfiguration.get(`foo`)?.get(`npmAlwaysAuth`)).toBe(true);

        expect(scopeConfiguration.get(`bar`)?.get(`npmAlwaysAuth`)).toBe(true);
      });
    });

    it(`should merge mergeable array properties`, async () => {
      await initializeConfiguration({
        logFilters: [
          {
            code: `YN0005`,
            level: `info`,
          },
        ],

        unsafeHttpWhitelist: [
          `example.com`,
        ],
      }, async dir => {
        const configuration = await Configuration.find(dir, null);

        configuration.useWithSource(`second file`, {
          logFilters: [
            {
              code: `YN0027`,
              level: `error`,
            },
          ],

          unsafeHttpWhitelist: [
            `evil.com`,
          ],
        }, dir);

        expect(configuration.get(`logFilters`)).toEqual([
          new Map(Object.entries({
            code: `YN0027`,
            text: undefined,
            level: `error`,
          })),
          new Map(Object.entries({
            code: `YN0005`,
            text: undefined,
            level: `info`,
          })),
        ]);
        expect(configuration.get(`unsafeHttpWhitelist`)).toEqual([
          `example.com`,
        ]);

        configuration.useWithSource(`override file`, {
          logFilters: [
            {
              code: `YN0066`,
              level: `warning`,
            },
          ],

          unsafeHttpWhitelist: [
            `yarnpkg.com`,
          ],
        }, dir, {overwrite: true});

        expect(configuration.get(`logFilters`)).toEqual([
          new Map(Object.entries({
            code: `YN0027`,
            text: undefined,
            level: `error`,
          })),
          new Map(Object.entries({
            code: `YN0005`,
            text: undefined,
            level: `info`,
          })),
          new Map(Object.entries({
            code: `YN0066`,
            text: undefined,
            level: `warning`,
          })),
        ]);
        expect(configuration.get(`unsafeHttpWhitelist`)).toEqual([
          `yarnpkg.com`,
        ]);
      });
    });
  });
});
