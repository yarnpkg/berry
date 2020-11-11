import {Configuration, Manifest, MapConfigurationValue} from '@yarnpkg/core';

export enum RegistryType {
  FETCH_REGISTRY = `npmRegistryServer`,
  PUBLISH_REGISTRY = `npmPublishRegistry`,
}

export type RegistryConfiguration = MapConfigurationValue<{
  npmAlwaysAuth: boolean | null;
  npmAuthIdent: string | null;
  npmAuthToken: string | null;

  npmRegistryServer: string;
}>

export interface MapLike {
  get(key: string): any;
}

export function normalizeRegistry(registry: string): string;
export function normalizeRegistry(registry: null): null;
export function normalizeRegistry(registry: string | null): string | null {
  if (registry === null)
    return null;
  return registry.replace(/\/$/, ``);
}

export function getRegistryByType({configuration, type = RegistryType.FETCH_REGISTRY}: {configuration: MapLike, type?: RegistryType}): string | null {
  return normalizeRegistry(configuration.get(type) ?? configuration.get(RegistryType.FETCH_REGISTRY));
}

export function getPublishRegistry(manifest: Manifest, {configuration}: {configuration: Configuration}) {
  return getPublishRegistryConfiguration(manifest, {configuration}).get(`npmRegistryServer`);
}

export function getScopeRegistry(scope: string | null, {configuration, type = RegistryType.FETCH_REGISTRY}: {configuration: Configuration, type?: RegistryType}): string {
  return getScopeRegistryConfiguration(scope, {configuration, type}).get(`npmRegistryServer`);
}

export function getDefaultRegistry({configuration, type = RegistryType.FETCH_REGISTRY}: {configuration: Configuration, type?: RegistryType}): string {
  return getDefaultRegistryConfiguration({configuration, type}).get(`npmRegistryServer`);
}

export function getPublishRegistryConfiguration(manifest: Manifest, {configuration}: {configuration: Configuration}) {
  if (manifest.publishConfig && manifest.publishConfig.registry) {
    const registry = normalizeRegistry(manifest.publishConfig.registry);
    return getEffectiveRegistryConfiguration(registry, {configuration, authConfiguration: new Map()});
  }

  return getScopeRegistryConfiguration(manifest.name?.scope ?? null, {configuration, type: RegistryType.PUBLISH_REGISTRY});
}

export function getScopeRegistryConfiguration(scope: string | null, {configuration, type = RegistryType.FETCH_REGISTRY}: {configuration: Configuration, type?: RegistryType}): RegistryConfiguration {
  const scopeConfiguration = getScopeAuthConfiguration(scope, {configuration});
  if (scopeConfiguration === null)
    return getDefaultRegistryConfiguration({configuration, type});

  const scopeRegistry = getRegistryByType({configuration: scopeConfiguration, type});
  if (scopeRegistry !== null)
    return getEffectiveRegistryConfiguration(scopeRegistry, {configuration, authConfiguration: scopeConfiguration});

  const authConfiguration = new Map();
  const authFields = [`npmAlwaysAuth`, `npmAuthIdent`, `npmAuthToken`] as const;
  for (const field of authFields)
    authConfiguration.set(field, scopeConfiguration.get(field));

  // the scope is falling back to the default registry URL declared at the top
  // level, fill any missing values with the default auth configuration
  for (const field of authFields)
    if (authConfiguration.get(field) === null)
      authConfiguration.set(field, configuration.get(field));

  const defaultRegistry = getRegistryByType({configuration, type})!;
  return getEffectiveRegistryConfiguration(defaultRegistry, {configuration, authConfiguration});
}

export function getDefaultRegistryConfiguration({configuration, type = RegistryType.FETCH_REGISTRY}: {configuration: Configuration, type?: RegistryType}): RegistryConfiguration {
  const defaultRegistry = getRegistryByType({configuration, type})!;
  return getEffectiveRegistryConfiguration(defaultRegistry, {configuration});
}

export function getRegistryAuthConfiguration(registry: string, {configuration}: {configuration: Configuration}): MapLike | null {
  const registryConfigurations = configuration.get(`npmRegistries`);

  const exactEntry = registryConfigurations.get(registry);
  if (typeof exactEntry !== `undefined`)
    return exactEntry;

  const noProtocolEntry = registryConfigurations.get(registry.replace(/^[a-z]+:/, ``));
  if (typeof noProtocolEntry !== `undefined`)
    return noProtocolEntry;

  return null;
}

export function getScopeAuthConfiguration(scope: string | null, {configuration}: {configuration: Configuration}): MapLike | null {
  if (scope === null)
    return null;

  const scopeConfigurations = configuration.get(`npmScopes`);

  const scopeConfiguration = scopeConfigurations.get(scope);
  if (!scopeConfiguration)
    return null;

  return scopeConfiguration;
}

export function getEffectiveRegistryConfiguration(registry: string, {configuration, authConfiguration}: {configuration: Configuration, authConfiguration?: MapLike}): RegistryConfiguration {
  const effectiveConfiguration = new Map();
  effectiveConfiguration.set(`npmRegistryServer`, registry);
  const authFields = [`npmAlwaysAuth`, `npmAuthIdent`, `npmAuthToken`] as const;

  const registryConfiguration = getRegistryAuthConfiguration(registry, {configuration});
  if (registryConfiguration !== null)
    for (const field of authFields)
      effectiveConfiguration.set(field, registryConfiguration.get(field));

  // apply values on top of base registry configuration
  if (authConfiguration)
    for (const field of authFields)
      if (authConfiguration.get(field) != null)
        effectiveConfiguration.set(field, authConfiguration.get(field));

  // fall back to top level defaults if no initial auth configuration was given
  if (!authConfiguration)
    for (const field of authFields)
      if (effectiveConfiguration.get(field) == null)
        effectiveConfiguration.set(field, configuration.get(field));

  return effectiveConfiguration;
}
