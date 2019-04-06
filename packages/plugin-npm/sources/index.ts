import {Plugin, SettingsType} from '@berry/core';

import {NpmFetcher}           from './NpmFetcher';
import {NpmRemapResolver}     from './NpmRemapResolver';
import {NpmSemverResolver}    from './NpmSemverResolver';
import {NpmTagResolver}       from './NpmTagResolver';

const plugin: Plugin = {
  configuration: {
    npmRegistryServer: {
      description: `URL of the selected npm registry (note: npm enterprise isn't supported)`,
      type: SettingsType.STRING,
      default: `https://registry.yarnpkg.com`,
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
