import {structUtils}                       from '@yarnpkg/core';
import {npath, xfs, PortablePath}          from '@yarnpkg/fslib';
import {stringifySyml}                     from '@yarnpkg/parsers';
import NpmPlugin                           from '@yarnpkg/plugin-npm';

import {Configuration, SECRET, TAG_REGEXP} from '../sources/Configuration';

const initConfigurationPlugin = async (configuration: string) => {
  const CONFIGURATION_PLUGIN = `
    const factory = r => {
      return {
        default: {
          configuration: ${configuration},
        },
      };
    };

    const name = '@yarnpkg/plugin-temp';
    module.exports = {factory, name};
  `;
  const path = await xfs.mktempPromise();
  const tempPluginPath = `${path}/plugin-temp.js` as PortablePath;
  await xfs.writeFilePromise(tempPluginPath, CONFIGURATION_PLUGIN);
  const plugin = require(npath.fromPortablePath(tempPluginPath));
  return {
    plugins: [tempPluginPath],
    pluginConfiguration: {
      modules: new Map([[plugin.name, plugin]]),
      plugins: new Set([plugin.name]),
    },
  };
};

async function initializeConfiguration<T>(value: {[key: string]: any}, cb: (dir: PortablePath) => Promise<T>) {
  return await xfs.mktempPromise(async dir => {
    await Configuration.updateConfiguration(dir, value);

    return await cb(dir);
  });
}

describe(`TAG_REGEXP`, () => {
  const validTags = [
    `canary`,
    `latest`,
    `next`,
    `legacy_v1`,
  ];

  it(`should allow all valid tags`, () => {
    const badTags = validTags.filter(tag => !TAG_REGEXP.test(tag));
    expect(badTags.length).toBe(0);
  });
});

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
          npmRegistryServer: {
            onConflict: `skip`,
            value: `http://bar.server`,
          },
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
        expect(scopeConfiguration.get(`foo`)?.get(`npmAlwaysAuth`)).toBe(true);

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
        }, dir);

        expect(configuration.get(`npmRegistryServer`)).toBe(`http://bar.server`);

        const scopeConfiguration = configuration.get(`npmScopes`);
        expect(scopeConfiguration.get(`foo`)?.get(`npmAuthToken`)).toBe(`token for foo`);
        expect(scopeConfiguration.get(`foo`)?.get(`npmAlwaysAuth`)).toBe(true);

        expect(scopeConfiguration.get(`bar`)?.get(`npmAlwaysAuth`)).toBe(true);
      });
    });

    it(`should merge mergeable array properties`, async () => {
      await initializeConfiguration({
        logFilters: [{
          code: `YN0005`,
          level: `info`,
        }],

        unsafeHttpWhitelist: [
          `example.com`,
        ],
      }, async dir => {
        const configuration = await Configuration.find(dir, null);

        configuration.useWithSource(`second file`, {
          logFilters: [{
            code: `YN0027`,
            level: `error`,
          }],

          unsafeHttpWhitelist: [
            `evil.com`,
          ],
        }, dir);

        expect(configuration.get(`logFilters`)).toEqual([
          new Map(Object.entries({
            code: `YN0005`,
            text: undefined,
            pattern: undefined,
            level: `info`,
          })),
          new Map(Object.entries({
            code: `YN0027`,
            text: undefined,
            pattern: undefined,
            level: `error`,
          })),
        ]);

        expect(configuration.get(`unsafeHttpWhitelist`)).toEqual([
          `example.com`,
          `evil.com`,
        ]);

        configuration.useWithSource(`override file`, {
          logFilters: {
            onConflict: `reset`,
            value: [{
              code: `YN0066`,
              level: `warning`,
            }],
          },

          unsafeHttpWhitelist: {
            onConflict: `reset`,
            value: [
              `yarnpkg.com`,
            ],
          },
        }, dir);

        expect(configuration.get(`logFilters`)).toEqual([
          new Map(Object.entries({
            code: `YN0066`,
            text: undefined,
            pattern: undefined,
            level: `warning`,
          })),
        ]);

        expect(configuration.get(`unsafeHttpWhitelist`)).toEqual([
          `yarnpkg.com`,
        ]);
      });
    });
  });

  it(`it should get the default value, if there is no set value`, async () => {
    // yarn don‘t support LOCATOR, LOCATOR_LOOSE has a default value
    const {plugins, pluginConfiguration} = await initConfigurationPlugin(`{
      any: {
        description: "",
        type: "ANY",
        default: "any",
      },
      boolean: {
        description: "",
        type: "BOOLEAN",
        default: false,
      },
      absolutePath: {
        description: "",
        type: "ABSOLUTE_PATH",
        default: "/absolutePath",
      },
      number: {
        description: "",
        type: "NUMBER",
        default: 0,
      },
      string: {
        description: "",
        type: "STRING",
        default: "string",
      },
      secret: {
        description: "",
        type: "SECRET",
        default: "secret",
      },
      shape: {
        description: "",
        type: "SHAPE",
        properties: {
          number: {
            description: "",
            type: "NUMBER",
            default: 0,
          },
          string: {
            description: "",
            type: "STRING",
            default: "string",
          },
        },
      },
      map: {
        description: "",
        type: "MAP",
        valueDefinition: {
          description: "",
          type: "SHAPE",
          properties: {
            number: {
              description: "",
              type: "NUMBER",
              default: 0,
            },
            string: {
              description: "",
              type: "STRING",
              default: "string",
            },
          },
        },
      },
      array: {
        description: "",
        type: "STRING",
        isArray: true,
        default: ["1", "2"],
      },
    }`);

    await initializeConfiguration({
      plugins,
      map: {
        foo: { // empty objects are discarded by `stringifySyml`.
          string: `Not important`,
        },
      },
    }, async dir => {
      const configuration = await Configuration.find(dir, pluginConfiguration);

      expect(configuration.get(`any`)).toBe(`any`);
      expect(configuration.get(`boolean`)).toBe(false);
      expect(configuration.get(`absolutePath`)).toBe(`/absolutePath`);
      expect(configuration.get(`number`)).toBe(0);
      expect(configuration.get(`string`)).toBe(`string`);
      expect(configuration.get(`secret`)).toBe(`secret`);

      const shape = configuration.get(`shape`) as Map<string, any>;
      expect(shape.get(`number`)).toBe(0);
      expect(shape.get(`string`)).toBe(`string`);

      const map = configuration.get(`map`) as Map<string, any>;
      const mapShape = map.get(`foo`) as Map<string, any>;
      expect(mapShape.get(`number`)).toBe(0);

      const array = configuration.get(`array`) as Array<string>;
      expect(array[0]).toBe(`1`);
      expect(array[1]).toBe(`2`);
    });
  });

  describe(`useWithSource`, () => {
    it(`it should set the correct value according to the options (single value)`, async() => {
      const {plugins, pluginConfiguration} = await initConfigurationPlugin(`{
        any: {
          description: "",
          type: "ANY",
          default: "",
        },
        boolean: {
          description: "",
          type: "BOOLEAN",
          default: false,
        },
        absolutePath: {
          description: "",
          type: "ABSOLUTE_PATH",
          default: ".",
        },
        locator: {
          description: "",
          type: "LOCATOR",
          default: "",
        },
        locatorLoose: {
          description: "",
          type: "LOCATOR_LOOSE",
          default: "",
        },
        number: {
          description: "",
          type: "NUMBER",
          default: 0,
        },
        string: {
          description: "",
          type: "STRING",
          default: "",
        },
        secret: {
          description: "",
          type: "SECRET",
          default: "",
        },
      }`);

      await initializeConfiguration({
        plugins,
        any: `any`,
        boolean: true,
        absolutePath: `/absolutePath`,
        locator: `locator`,
        locatorLoose: `locatorLoose`,
        number: 1,
        string: `string`,
        secret: `secret`,
      }, async dir => {
        const configuration = await Configuration.find(dir, pluginConfiguration);

        configuration.useWithSource(`skip file`, {
          onConflict: `skip`,
          any: `any2`,
          boolean: false,
          absolutePath: `/absolutePath2`,
          locator: `locator2`,
          locatorLoose: `locatorLoose2`,
          number: 2,
          string: `string2`,
          secret: `secret2`,
        }, dir);

        expect(configuration.get(`any`)).toBe(`any`);
        expect(configuration.get(`boolean`)).toBe(true);
        expect(configuration.get(`absolutePath`)).toBe(`/absolutePath`);
        expect(configuration.get(`locator`)).toEqual(structUtils.parseLocator(`locator`));
        expect(configuration.get(`locatorLoose`)).toEqual(structUtils.parseLocator(`locatorLoose`, false));
        expect(configuration.get(`number`)).toBe(1);
        expect(configuration.get(`string`)).toBe(`string`);
        expect(configuration.get(`secret`)).toBe(`secret`);

        configuration.useWithSource(`extend file`, {
          onConflict: `extend`,
          any: `any2`,
          boolean: false,
          absolutePath: `/absolutePath2`,
          locator: `locator2`,
          locatorLoose: `locatorLoose2`,
          number: 2,
          string: `string2`,
          secret: `secret2`,
        }, dir);

        expect(configuration.get(`any`)).toBe(`any2`);
        expect(configuration.get(`boolean`)).toBe(false);
        expect(configuration.get(`absolutePath`)).toBe(`/absolutePath2`);
        expect(configuration.get(`locator`)).toEqual(structUtils.parseLocator(`locator2`));
        expect(configuration.get(`locatorLoose`)).toEqual(structUtils.parseLocator(`locatorLoose2`, false));
        expect(configuration.get(`number`)).toBe(2);
        expect(configuration.get(`string`)).toBe(`string2`);
        expect(configuration.get(`secret`)).toBe(`secret2`);

        configuration.useWithSource(`reset file`, {
          onConflict: `reset`,
          any: `any3`,
          boolean: true,
          absolutePath: `/absolutePath3`,
          locator: `locator3`,
          locatorLoose: `locatorLoose3`,
          number: 3,
          string: `string3`,
          secret: `secret3`,
        }, dir);

        expect(configuration.get(`any`)).toBe(`any3`);
        expect(configuration.get(`boolean`)).toBe(true);
        expect(configuration.get(`absolutePath`)).toBe(`/absolutePath3`);
        expect(configuration.get(`locator`)).toEqual(structUtils.parseLocator(`locator3`));
        expect(configuration.get(`locatorLoose`)).toEqual(structUtils.parseLocator(`locatorLoose3`, false));
        expect(configuration.get(`number`)).toBe(3);
        expect(configuration.get(`string`)).toBe(`string3`);
        expect(configuration.get(`secret`)).toBe(`secret3`);
      });
    });

    it(`it should set the correct value according to the options (complex value)`, async() => {
      const {plugins, pluginConfiguration} = await initConfigurationPlugin(`{
        stringArray: {
          description: "",
          type: "STRING",
          isArray: true,
          default: [],
        },
        shape: {
          description: "",
          type: "SHAPE",
          properties: {
            number: {
              description: "",
              type: "NUMBER",
              default: 0,
            },
            string: {
              description: "",
              type: "STRING",
              default: "default",
            },
          },
        },
        map: {
          description: "",
          type: "MAP",
          valueDefinition: {
            description: "",
            type: "SHAPE",
            properties: {
              number: {
                description: "",
                type: "NUMBER",
                default: 0,
              },
              string: {
                description: "",
                type: "STRING",
                default: "default",
              },
            },
          },
        },
      }`);
      await initializeConfiguration({
        plugins,
        stringArray: [`foo`],
        shape: {
          number: 1,
        },
        map: {
          foo: {number: 1},
          bar: {number: 1},
        },
      }, async dir => {
        const configuration = await Configuration.find(dir, pluginConfiguration);

        configuration.useWithSource(`skip file`, {
          onConflict: `skip`,
          stringArray: [`bar`],
          shape: {
            string: `bar`,
          },
          map: {
            foo: {string: `bar`},
            bar: {string: `bar`},
          },
        }, dir);

        expect(configuration.get(`stringArray`)).toEqual([`foo`]);

        expect(configuration.get(`shape`)).toEqual(new Map<string, any>([
          [`number`, 1],
          [`string`, `default`],
        ]));

        expect(configuration.get(`map`)).toEqual(new Map([
          [`foo`, new Map<string, any>([[`number`, 1], [`string`, `default`]])],
          [`bar`, new Map<string, any>([[`number`, 1], [`string`, `default`]])],
        ]));

        configuration.useWithSource(`extend file`, {
          onConflict: `extend`,
          stringArray: [`bar`],
          shape: {
            string: `bar`,
          },
          map: {
            foo: {string: `bar`},
            bar: {string: `bar`},
          },
        }, dir);

        expect(configuration.get(`stringArray`)).toEqual([`foo`, `bar`]);

        expect(configuration.get(`shape`)).toEqual(new Map<string, any>([
          [`number`, 1],
          [`string`, `bar`],
        ]));

        expect(configuration.get(`map`)).toEqual(new Map([
          [`foo`, new Map<string, any>([[`number`, 1], [`string`, `bar`]])],
          [`bar`, new Map<string, any>([[`number`, 1], [`string`, `bar`]])],
        ]));

        configuration.useWithSource(`reset file`, {
          onConflict: `reset`,
          stringArray: [`bar`],
          shape: {
            number: 2,
          },
          map: {
            bar: {number: 2, string: `bar`},
          },
        }, dir);

        expect(configuration.get(`stringArray`)).toEqual([`bar`]);

        expect(configuration.get(`shape`)).toEqual(new Map<string, any>([
          [`number`, 2],
          [`string`, `default`],
        ]));

        expect(configuration.get(`map`)).toEqual(new Map([
          [`bar`, new Map<string, any>([[`number`, 2], [`string`, `bar`]])],
        ]));
      });
    });
  });

  describe(`multiple RC files`, () => {
    it(`it should correctly extend or reset or skip the values`, async() => {
      const {plugins, pluginConfiguration} = await initConfigurationPlugin(`{
        string: {
          description: "",
          type: "STRING",
          default: "",
        },
        stringReset: {
          description: "",
          type: "STRING",
          default: "",
        },
        stringSkip: {
          description: "",
          type: "STRING",
          default: "",
        },
        stringArray: {
          description: "",
          type: "STRING",
          isArray: true,
          default: [],
        },
        stringArrayReset: {
          description: "",
          type: "STRING",
          isArray: true,
          default: [],
        },
        stringArraySkip: {
          description: "",
          type: "STRING",
          isArray: true,
          default: [],
        },
        shape: {
          description: "",
          type: "SHAPE",
          properties: {
            number: {
              description: "",
              type: "NUMBER",
              default: 0,
            },
            string: {
              description: "",
              type: "STRING",
              default: "default",
            },
          },
        },
        shapeReset: {
          description: "",
          type: "SHAPE",
          properties: {
            number: {
              description: "",
              type: "NUMBER",
              default: 0,
            },
            string: {
              description: "",
              type: "STRING",
              default: "default",
            },
          },
        },
        shapeSkip: {
          description: "",
          type: "SHAPE",
          properties: {
            number: {
              description: "",
              type: "NUMBER",
              default: 0,
            },
            string: {
              description: "",
              type: "STRING",
              default: "default",
            },
          },
        },
        map: {
          description: "",
          type: "MAP",
          valueDefinition: {
            description: "",
            type: "SHAPE",
            properties: {
              number: {
                description: "",
                type: "NUMBER",
                default: 0,
              },
              string: {
                description: "",
                type: "STRING",
                default: "default",
              },
            },
          },
        },
        mapReset: {
          description: "",
          type: "MAP",
          valueDefinition: {
            description: "",
            type: "SHAPE",
            properties: {
              number: {
                description: "",
                type: "NUMBER",
                default: 0,
              },
              string: {
                description: "",
                type: "STRING",
                default: "default",
              },
            },
          },
        },
        mapSkip: {
          description: "",
          type: "MAP",
          valueDefinition: {
            description: "",
            type: "SHAPE",
            properties: {
              number: {
                description: "",
                type: "NUMBER",
                default: 0,
              },
              string: {
                description: "",
                type: "STRING",
                default: "default",
              },
            },
          },
        },
      }`);

      await initializeConfiguration({
        plugins,
        string: `foo`,
        stringReset: `foo`,
        stringSkip: `foo`,
        stringArray: [`foo`],
        stringArrayReset: [`foo`],
        stringArraySkip: [`foo`],
        shape: {
          string: `foo`,
        },
        shapeReset: {
          string: `foo`,
        },
        shapeSkip: {
          string: `foo`,
        },
        map: {
          foo: {string: `foo`},
        },
        mapReset: {
          foo: {string: `foo`},
        },
        mapSkip: {
          foo: {string: `foo`},
        },
      }, async dir => {
        const workspaceDirectory = `${dir}/workspace` as PortablePath;

        await xfs.mkdirPromise(workspaceDirectory);
        await xfs.writeFilePromise(`${workspaceDirectory}/.yarnrc.yml` as PortablePath, stringifySyml({
          string: `bar`,
          stringReset: {
            onConflict: `reset`,
            value: `bar`,
          },
          stringSkip: {
            onConflict: `skip`,
            value: `bar`,
          },
          stringArray: [`bar`],
          stringArrayReset: {
            onConflict: `reset`,
            value: [`bar`],
          },
          stringArraySkip: {
            onConflict: `skip`,
            value: [`bar`],
          },
          shape: {
            number: 2,
          },
          shapeReset: {
            onConflict: `reset`,
            value: {
              number: 2,
            },
          },
          shapeSkip: {
            onConflict: `skip`,
            value: {
              number: 2,
            },
          },
          map: {
            bar: {number: 2, string: `bar`},
          },
          mapReset: {
            onConflict: `reset`,
            value: {
              bar: {number: 2, string: `bar`},
            },
          },
          mapSkip: {
            onConflict: `skip`,
            value: {
              bar: {number: 2, string: `bar`},
            },
          },
        }));

        const configuration = await Configuration.find(workspaceDirectory, pluginConfiguration);

        expect(configuration.get(`string`)).toBe(`bar`);
        expect(configuration.get(`stringReset`)).toBe(`bar`);
        expect(configuration.get(`stringSkip`)).toBe(`foo`);
        expect(configuration.get(`stringArray`)).toEqual([`foo`, `bar`]);
        expect(configuration.get(`stringArrayReset`)).toEqual([`bar`]);
        expect(configuration.get(`stringArraySkip`)).toEqual([`foo`]);
        expect(configuration.get(`shape`)).toEqual(new Map<string, any>([[`number`, 2], [`string`, `foo`]]));
        expect(configuration.get(`shapeReset`)).toEqual(new Map<string, any>([[`number`, 2], [`string`, `default`]]));
        expect(configuration.get(`shapeSkip`)).toEqual(new Map<string, any>([[`number`, 0], [`string`, `foo`]]));

        expect(configuration.get(`map`)).toEqual(new Map([
          [`foo`, new Map<string, any>([[`number`, 0], [`string`, `foo`]])],
          [`bar`, new Map<string, any>([[`number`, 2], [`string`, `bar`]])],
        ]));

        expect(configuration.get(`mapReset`)).toEqual(new Map([
          [`bar`, new Map<string, any>([[`number`, 2], [`string`, `bar`]])],
        ]));

        expect(configuration.get(`mapSkip`)).toEqual(new Map([
          [`foo`, new Map<string, any>([[`number`, 0], [`string`, `foo`]])],
        ]));
      });
    });
  });
});
