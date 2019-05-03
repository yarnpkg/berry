import {Configuration, Ident} from '@berry/core';

function getScopedConfiguration(ident: Ident, configuration: Configuration): Configuration|Map<string, any> {
  if (ident.scope) {
    const scopeConfigurations: Map<string, Map<string, any>> | null = configuration.get(`npmScopes`);
    if (scopeConfigurations && scopeConfigurations.has(ident.scope))
      return scopeConfigurations.get(ident.scope)!;

    const scopeWithAt = `@${ident.scope}`;
    if (scopeConfigurations && scopeConfigurations.has(scopeWithAt)) {
      return scopeConfigurations.get(scopeWithAt)!;
    }
  }

  return configuration;
}

export function getRegistry(ident: Ident, configuration: Configuration): string {
  return getScopedConfiguration(ident, configuration).get(`npmRegistryServer`);
}

export function getAuthenticationConfiguration(ident: Ident, configuration: Configuration): Configuration | Map<string, any> {
  const registryConfigurations: Map<string, Map<string, any>> | null = configuration.get(`npmRegistries`);

  if (registryConfigurations) {
    const registry = getRegistry(ident, configuration);
    if (registryConfigurations.has(registry))
      return registryConfigurations.get(registry)!;

    const registryWithoutProtocol = registry.replace(/^[a-z]+:/, '');
    if (registryConfigurations.has(registryWithoutProtocol)) {
      return registryConfigurations.get(registryWithoutProtocol)!;
    }
  }

  return getScopedConfiguration(ident, configuration);
}
