import {Plugin, SettingsType, DurationUnit, miscUtils, Configuration, Ident} from '@yarnpkg/core';
import type {SettingsDefinition}                                             from '@yarnpkg/core';

import {NpmHttpFetcher}                                                      from './NpmHttpFetcher';
import {NpmRemapResolver}                                                    from './NpmRemapResolver';
import {NpmSemverFetcher}                                                    from './NpmSemverFetcher';
import {NpmSemverResolver}                                                   from './NpmSemverResolver';
import {NpmTagResolver}                                                      from './NpmTagResolver';
import * as npmConfigUtils                                                   from './npmConfigUtils';
import * as npmHttpUtils                                                     from './npmHttpUtils';
import * as npmPublishUtils                                                  from './npmPublishUtils';

export {npmConfigUtils};
export {npmHttpUtils};
export {npmPublishUtils};
export {NpmHttpFetcher};
export {NpmRemapResolver};
export {NpmSemverFetcher};
export {NpmSemverResolver};
export {NpmTagResolver};

export interface Hooks {
  /**
   * Called when getting the authentication header for a request to the npm registry.
   * You can use this mechanism to dynamically query a CLI for the credentials for a
   * specific registry.
   */
  getNpmAuthenticationHeader?: (currentHeader: string | undefined, registry: string, {
    configuration,
    ident,
  }: {configuration: Configuration, ident?: Ident}) => Promise<string | undefined>;
}


const authSettings = {
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
} satisfies Record<string, SettingsDefinition>;

const registrySettings = {
  npmAuditRegistry: {
    description: `Registry to query for audit reports`,
    type: SettingsType.STRING,
    default: null,
  },
  npmPublishRegistry: {
    description: `Registry to push packages to`,
    type: SettingsType.STRING,
    default: null,
  },
  npmRegistryServer: {
    description: `URL of the selected npm registry (note: npm enterprise isn't supported)`,
    type: SettingsType.STRING,
    default: `https://registry.yarnpkg.com`,
  },
} satisfies Record<string, SettingsDefinition>;

const packageGateSettings = {
  npmMinimalAgeGate: {
    description: `Minimum age of a package version according to the publish date on the npm registry to be considered for installation`,
    type: SettingsType.DURATION,
    unit: DurationUnit.MINUTES,
    default: `0m`,
  },
  npmPreapprovedPackages: {
    description: `Array of package descriptors or package name glob patterns to exclude from the minimum release age check`,
    type: SettingsType.STRING,
    isArray: true,
    default: [],
  },
} satisfies Record<string, SettingsDefinition>;

declare module '@yarnpkg/core' {
  interface ConfigurationValueMap {
    npmAlwaysAuth: boolean;
    npmAuthIdent: string | null;
    npmAuthToken: string | null;

    npmAuditRegistry: string | null;
    npmPublishRegistry: string | null;
    npmRegistryServer: string;

    npmMinimalAgeGate: number;
    npmPreapprovedPackages: Array<string>;

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
    ...packageGateSettings,

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
