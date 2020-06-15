import {Configuration, Manifest, Ident} from '@yarnpkg/core';

export enum RegistryType {
  FETCH_REGISTRY = `npmRegistryServer`,
  PUBLISH_REGISTRY = `npmPublishRegistry`,
}

export interface MapLike {
  get(key: string): any;
}

export function normalizeRegistry(registry: string) {
  return registry.replace(/\/$/, ``);
}

export function getPublishRegistry(manifest: Manifest, {configuration}: {configuration: Configuration}) {
  if (manifest.publishConfig && manifest.publishConfig.registry)
    return normalizeRegistry(manifest.publishConfig.registry);

  if (manifest.name)
    return getScopeRegistry(manifest.name.scope, {configuration, type: RegistryType.PUBLISH_REGISTRY});

  return getDefaultRegistry({configuration, type: RegistryType.PUBLISH_REGISTRY});
}

export function getScopeRegistry(scope: string | null, {configuration, type = RegistryType.FETCH_REGISTRY}: {configuration: Configuration, type?: RegistryType}): string {
  const scopeConfiguration = getScopeConfiguration(scope, {configuration});
  if (scopeConfiguration === null)
    return getDefaultRegistry({configuration, type});

  const scopeRegistry = scopeConfiguration.get(type);
  if (scopeRegistry === null)
    return getDefaultRegistry({configuration, type});

  return normalizeRegistry(scopeRegistry);
}

export function getDefaultRegistry({configuration, type = RegistryType.FETCH_REGISTRY}: {configuration: Configuration, type?: RegistryType}): string {
  const defaultRegistry = configuration.get(type);
  if (defaultRegistry !== null)
    return normalizeRegistry(defaultRegistry);

  return normalizeRegistry(configuration.get(RegistryType.FETCH_REGISTRY));
}

export function getRegistryConfiguration(registry: string, {configuration}: {configuration: Configuration}): MapLike | null {
  const registryConfigurations: Map<string, MapLike> = configuration.get(`npmRegistries`);

  const exactEntry = registryConfigurations.get(registry);
  if (typeof exactEntry !== `undefined`)
    return exactEntry;

  const noProtocolEntry = registryConfigurations.get(registry.replace(/^[a-z]+:/, ``));
  if (typeof noProtocolEntry !== `undefined`)
    return noProtocolEntry;

  return null;
}

export function getScopeConfiguration(scope: string | null, {configuration}: {configuration: Configuration}): MapLike | null {
  if (scope === null)
    return null;

  const scopeConfigurations: Map<string, MapLike> = configuration.get(`npmScopes`);

  const scopeConfiguration = scopeConfigurations.get(scope);
  if (!scopeConfiguration)
    return null;

  return scopeConfiguration;
}

export function getAuthConfiguration(registry: string, {configuration, ident}: {configuration: Configuration, ident?: Ident}): MapLike {
  const scopeConfiguration = ident && getScopeConfiguration(ident.scope, {configuration});

  if (scopeConfiguration?.get(`npmAuthIdent`) || scopeConfiguration?.get(`npmAuthToken`))
    return scopeConfiguration;

  const registryConfiguration = getRegistryConfiguration(registry, {configuration});

  return registryConfiguration || configuration;
}
