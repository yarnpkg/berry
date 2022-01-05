import {Plugin, SettingsType, miscUtils} from '@yarnpkg/core';

import {Hooks}                           from './Hooks';
import {NpmHttpFetcher}                  from './NpmHttpFetcher';
import {NpmRemapResolver}                from './NpmRemapResolver';
import {NpmSemverFetcher}                from './NpmSemverFetcher';
import {NpmSemverResolver}               from './NpmSemverResolver';
import {NpmTagResolver}                  from './NpmTagResolver';
import * as npmConfigUtils               from './npmConfigUtils';
import * as npmHttpUtils                 from './npmHttpUtils';
import * as npmPublishUtils              from './npmPublishUtils';

export {npmConfigUtils};
export {npmHttpUtils};
export {npmPublishUtils};
export type {Hooks};

const authSettings = {
  npmAlwaysAuth: {
    description: `URL of the selected npm registry (note: npm enterprise isn't supported)`,
    type: SettingsType.BOOLEAN as const,
    default: false,
  },
  npmAuthIdent: {
    description: `Authentication identity for the npm registry (_auth in npm and yarn v1)`,
    type: SettingsType.SECRET as const,
    default: null,
  },
  npmAuthToken: {
    description: `Authentication token for the npm registry (_authToken in npm and yarn v1)`,
    type: SettingsType.SECRET as const,
    default: null,
  },
};

const registrySettings = {
  npmAuditRegistry: {
    description: `Registry to query for audit reports`,
    type: SettingsType.STRING as const,
    default: null,
  },
  npmPublishRegistry: {
    description: `Registry to push packages to`,
    type: SettingsType.STRING as const,
    default: null,
  },
  npmRegistryServer: {
    description: `URL of the selected npm registry (note: npm enterprise isn't supported)`,
    type: SettingsType.STRING as const,
    default: `https://registry.yarnpkg.com`,
  },
};

declare module '@yarnpkg/core' {
  interface ConfigurationValueMap {
    npmAlwaysAuth: boolean;
    npmAuthIdent: string | null;
    npmAuthToken: string | null;

    npmAuditRegistry: string | null;
    npmPublishRegistry: string | null;
    npmRegistryServer: string;

    npmScopes:  Map<string, miscUtils.ToMapValue<{
      npmAlwaysAuth: boolean;
      npmAuthIdent: string | null;
      npmAuthToken: string | null;

      npmPublishRegistry: string | null;
      npmRegistryServer: string;
    }>>;
    npmRegistries: Map<string, miscUtils.ToMapValue<{
      npmAlwaysAuth: boolean;
      npmAuthIdent: string | null;
      npmAuthToken: string | null;
    }>>;
  }
}

const plugin: Plugin = {
  configuration: {
    ...authSettings,
    ...registrySettings,

    npmScopes: {
      description: `Settings per package scope`,
      type: SettingsType.MAP,
      valueDefinition: {
        description: ``,
        type: SettingsType.SHAPE,
        properties: {
          ...authSettings,
          ...registrySettings,
        },
      },
    },

    npmRegistries: {
      description: `Settings per registry`,
      type: SettingsType.MAP,
      normalizeKeys: npmConfigUtils.normalizeRegistry,
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
    NpmHttpFetcher,
    NpmSemverFetcher,
  ],
  resolvers: [
    NpmRemapResolver,
    NpmSemverResolver,
    NpmTagResolver,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
