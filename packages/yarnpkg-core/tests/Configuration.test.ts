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

  describe(`Environment interpolation`, () => {
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

  describe(`Configuration merging`, () => {
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
            code: `YN0027`,
            text: undefined,
            pattern: undefined,
            level: `error`,
          })),
          new Map(Object.entries({
            code: `YN0005`,
            text: undefined,
            pattern: undefined,
            level: `info`,
          })),
        ]);

        expect(configuration.get(`unsafeHttpWhitelist`)).toEqual([
          `example.com`,
        ]);

        configuration.useWithSource(`override file`, {
          logFilters: [{
            code: `YN0066`,
            level: `warning`,
          }],

          unsafeHttpWhitelist: [
            `yarnpkg.com`,
          ],
        }, dir, {overwrite: true});

        expect(configuration.get(`logFilters`)).toEqual([
          new Map(Object.entries({
            code: `YN0027`,
            text: undefined,
            pattern: undefined,
            level: `error`,
          })),
          new Map(Object.entries({
            code: `YN0005`,
            text: undefined,
            pattern: undefined,
            level: `info`,
          })),
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

  describe(`Multiple RC files`, () => {
    it(`it should correctly resolve the rc files`, async() => {
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
        stringExtend: {
          description: "",
          type: "STRING",
          default: "",
        },
        stringHardReset: {
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
        stringArrayExtend: {
          description: "",
          type: "STRING",
          isArray: true,
          default: [],
        },
        stringArrayHardReset: {
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
        shapeExtend: {
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
        shapeHardReset: {
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
        mapExtend: {
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
        mapHardReset: {
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
        any: {
          description: "",
          type: "ANY",
          default: "",
        },
        anyReset: {
          description: "",
          type: "ANY",
          default: "",
        },
        anyExtend: {
          description: "",
          type: "ANY",
          default: "",
        },
        anyHardReset: {
          description: "",
          type: "ANY",
          default: "",
        },
      }`);

      await initializeConfiguration({
        plugins,
        string: `foo`,
        stringReset: `foo`,
        stringExtend: `foo`,
        stringHardReset: `foo`,
        stringArray: [`foo`],
        stringArrayReset: [`foo`],
        stringArrayExtend: [`foo`],
        stringArrayHardReset: [`foo`],
        shape: {
          string: `foo`,
        },
        shapeReset: {
          string: `foo`,
        },
        shapeExtend: {
          string: `foo`,
        },
        shapeHardReset: {
          string: `foo`,
        },
        map: {
          foo: {string: `foo`},
        },
        mapReset: {
          foo: {string: `foo`},
        },
        mapExtend: {
          foo: {string: `foo`},
        },
        mapHardReset: {
          foo: {string: `foo`},
        },
        any: {
          foo: {string: `foo`},
        },
        anyReset: {
          foo: {string: `foo`},
        },
        anyExtend: {
          foo: {string: `foo`},
        },
        anyHardReset: {
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
          stringExtend: {
            onConflict: `extend`,
            value: `bar`,
          },
          stringHardReset: {
            onConflict: `reset`,
            value: `bar`,
          },
          stringArray: [`bar`],
          stringArrayReset: {
            onConflict: `reset`,
            value: [`bar`],
          },
          stringArrayExtend: {
            onConflict: `extend`,
            value: [`bar`],
          },
          stringArrayHardReset: {
            onConflict: `hardReset`,
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
          shapeExtend: {
            onConflict: `extend`,
            value: {
              number: 2,
            },
          },
          shapeHardReset: {
            onConflict: `hardReset`,
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
          mapExtend: {
            onConflict: `extend`,
            value: {
              bar: {number: 2, string: `bar`},
            },
          },
          mapHardReset: {
            onConflict: `hardReset`,
            value: {
              bar: {number: 2, string: `bar`},
            },
          },
          any: {
            bar: {number: 2, string: `bar`},
          },
          anyReset: {
            onConflict: `reset`,
            value: {
              bar: {number: 2, string: `bar`},
            },
          },
          anyExtend: {
            onConflict: `extend`,
            value: {
              bar: {number: 2, string: `bar`},
            },
          },
          anyHardReset: {
            onConflict: `hardReset`,
            value: {
              bar: {number: 2, string: `bar`},
            },
          },
        }));

        const workspaceDirectory2 = `${dir}/workspace/workspace` as PortablePath;
        await xfs.mkdirPromise(workspaceDirectory2);
        await xfs.writeFilePromise(`${workspaceDirectory2}/.yarnrc.yml` as PortablePath, stringifySyml({
          stringHardReset: `baz`,
          stringArrayHardReset: [`baz`],
          shapeHardReset: {
            string: `baz`,
          },
          mapHardReset: {
            baz: {string: `baz`},
          },
          anyHardReset: {
            baz: {string: `baz`},
          },
        }));

        const configuration = await Configuration.find(workspaceDirectory2, pluginConfiguration);

        expect(configuration.get(`string`)).toBe(`bar`);
        expect(configuration.get(`stringReset`)).toBe(`bar`);
        expect(configuration.get(`stringExtend`)).toBe(`bar`);
        expect(configuration.get(`stringHardReset`)).toBe(`baz`);

        expect(configuration.get(`stringArray`)).toEqual([`foo`, `bar`]);
        expect(configuration.get(`stringArrayReset`)).toEqual([`bar`]);
        expect(configuration.get(`stringArrayExtend`)).toEqual([`foo`, `bar`]);
        expect(configuration.get(`stringArrayHardReset`)).toEqual([`baz`]);

        expect(configuration.get(`shape`)).toEqual(new Map<string, any>([[`number`, 2], [`string`, `foo`]]));
        expect(configuration.get(`shapeReset`)).toEqual(new Map<string, any>([[`number`, 2], [`string`, `default`]]));
        expect(configuration.get(`shapeExtend`)).toEqual(new Map<string, any>([[`number`, 2], [`string`, `foo`]]));
        expect(configuration.get(`shapeHardReset`)).toEqual(new Map<string, any>([[`number`, 0], [`string`, `baz`]]));

        expect(configuration.get(`map`)).toEqual(new Map([
          [`foo`, new Map<string, any>([[`number`, 0], [`string`, `foo`]])],
          [`bar`, new Map<string, any>([[`number`, 2], [`string`, `bar`]])],
        ]));
        expect(configuration.get(`mapReset`)).toEqual(new Map([
          [`bar`, new Map<string, any>([[`number`, 2], [`string`, `bar`]])],
        ]));
        expect(configuration.get(`mapExtend`)).toEqual(new Map([
          [`foo`, new Map<string, any>([[`number`, 0], [`string`, `foo`]])],
          [`bar`, new Map<string, any>([[`number`, 2], [`string`, `bar`]])],
        ]));
        expect(configuration.get(`mapHardReset`)).toEqual(new Map([
          [`baz`, new Map<string, any>([[`number`, 0], [`string`, `baz`]])],
        ]));

        expect(configuration.get(`any`)).toEqual({bar: {number: `2`, string: `bar`}, foo: {string: `foo`}});
        expect(configuration.get(`anyReset`)).toEqual({bar: {number: `2`, string: `bar`}});
        expect(configuration.get(`anyExtend`)).toEqual({bar: {number: `2`, string: `bar`}, foo: {string: `foo`}});
        expect(configuration.get(`anyHardReset`)).toEqual({baz: {string: `baz`}});
      });
    });
  });
});
