import {Configuration, Ident} from '@berry/core';

interface MapLike {
  get(key: string): any;
}

export function getRegistry(ident: Ident | null, {configuration}: {configuration: Configuration}): string {
  return getScopedConfiguration(ident, {configuration}).get(`npmRegistryServer`);
}

export function getAuthenticationConfiguration(ident: Ident | null, {configuration}: {configuration: Configuration}): MapLike {
  const registryConfigurations: Map<string, Map<string, any>> | null = configuration.get(`npmRegistries`);

  if (registryConfigurations) {
    const registry = getRegistry(ident, {configuration});
    if (registryConfigurations.has(registry))
      return registryConfigurations.get(registry)!;

    const registryWithoutProtocol = registry.replace(/^[a-z]+:/, '');
    if (registryConfigurations.has(registryWithoutProtocol)) {
      return registryConfigurations.get(registryWithoutProtocol)!;
    }
  }

  return getScopedConfiguration(ident, {configuration});
}

function getScopedConfiguration(ident: Ident | null, {configuration}: {configuration: Configuration}): MapLike {
  if (ident && ident.scope) {
    const scopeConfigurations: Map<string, Map<string, any>> | null = configuration.get(`npmScopes`);
    if (scopeConfigurations && scopeConfigurations.has(ident.scope)) {
      return scopeConfigurations.get(ident.scope)!;
    }
  }

  return configuration;
}
