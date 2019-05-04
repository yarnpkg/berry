import {Plugin, SettingsType} from '@berry/core';

import {NpmFetcher}           from './NpmFetcher';
import {NpmRemapResolver}     from './NpmRemapResolver';
import {NpmSemverResolver}    from './NpmSemverResolver';
import {NpmTagResolver}       from './NpmTagResolver';
import * as npmHttpUtils      from './npmHttpUtils';

export {npmHttpUtils};

const plugin: Plugin = {
  configuration: {
    npmRegistryServer: {
      description: `URL of the selected npm registry (note: npm enterprise isn't supported)`,
      type: SettingsType.STRING,
      default: `https://registry.yarnpkg.com`,
    },
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
