import {Plugin, SettingsType} from '@berry/core';
import {SettingsDefinition}   from '@berry/core';

import {NpmFetcher}           from './NpmFetcher';
import {NpmRemapResolver}     from './NpmRemapResolver';
import {NpmSemverResolver}    from './NpmSemverResolver';
import {NpmTagResolver}       from './NpmTagResolver';
import * as npmConfigUtils    from './npmConfigUtils';
import * as npmHttpUtils      from './npmHttpUtils';

export {npmConfigUtils};
export {npmHttpUtils};

const authSettings: {[name: string]: SettingsDefinition} = {
  npmAlwaysAuth: {
    description: `URL of the selected npm registry (note: npm enterprise isn't supported)`,
    type: SettingsType.BOOLEAN,
    default: false,
  },
  npmAuthIdent: {
    description: `Authentication identity for the npm registry (_auth in npm and yarn v1)`,
    type: SettingsType.SECRET,
    default: null,
  },
  npmAuthToken: {
    description: `Authentication token for the npm registry (_authToken in npm and yarn v1)`,
    type: SettingsType.SECRET,
    default: null,
  },
};

const registrySettings: {[name: string]: SettingsDefinition} = {
  npmRegistryServer: {
    description: `URL of the selected npm registry (note: npm enterprise isn't supported)`,
    type: SettingsType.STRING,
    default: `https://registry.yarnpkg.com`,
  },

  ...authSettings,
}

const plugin: Plugin = {
  configuration: {
    ...registrySettings,

    npmScopes: {
      description: `Settings per package scope`,
      type: SettingsType.MAP,
      valueDefinition: {
        description: ``,
        type: SettingsType.SHAPE,
        properties: {
          ...registrySettings,
        },
      },
    },

    npmRegistries: {
      description: `Settings per registry`,
      type: SettingsType.MAP,
      valueDefinition: {
        description: ``,
        type: SettingsType.SHAPE,
        properties: {
          ...authSettings,
        },
      },
    },
  },
  fetchers: [
    NpmFetcher,
  ],
  resolvers: [
    NpmRemapResolver,
    NpmSemverResolver,
    NpmTagResolver,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
