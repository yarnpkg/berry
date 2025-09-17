import {Configuration, Manifest, Ident, structUtils, Descriptor} from '@yarnpkg/core';
import micromatch                                                from 'micromatch';

import {PROTOCOL}                                                from './constants';

export enum RegistryType {
  AUDIT_REGISTRY = `npmAuditRegistry`,
  FETCH_REGISTRY = `npmRegistryServer`,
  PUBLISH_REGISTRY = `npmPublishRegistry`,
}


export interface MapLike {
  get(key: string): any;
}

export function normalizeRegistry(registry: string) {
  return registry.replace(/\/$/, ``);
}

export function getAuditRegistry({configuration}: {configuration: Configuration}) {
  return getDefaultRegistry({configuration, type: RegistryType.AUDIT_REGISTRY});
}

export function getPublishRegistry(manifest: Manifest, {configuration}: {configuration: Configuration}) {
  if (manifest.publishConfig?.registry)
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
  const registryConfigurations = configuration.get(`npmRegistries`);
  const normalizedRegistry = normalizeRegistry(registry);

  const exactEntry = registryConfigurations.get(normalizedRegistry);
  if (typeof exactEntry !== `undefined`)
    return exactEntry;

  const noProtocolEntry = registryConfigurations.get(normalizedRegistry.replace(/^[a-z]+:/, ``));
  if (typeof noProtocolEntry !== `undefined`)
    return noProtocolEntry;

  return null;
}

const JSR_DEFAULT_SCOPE_CONFIGURATION = new Map([
  [`npmRegistryServer`, `https://npm.jsr.io/`],
]);

export function getScopeConfiguration(scope: string | null, {configuration}: {configuration: Configuration}): MapLike | null {
  if (scope === null)
    return null;

  const scopeConfigurations = configuration.get(`npmScopes`);

  const scopeConfiguration = scopeConfigurations.get(scope);
  if (scopeConfiguration)
    return scopeConfiguration;

  if (scope === `jsr`)
    return JSR_DEFAULT_SCOPE_CONFIGURATION;

  return null;
}

export function getAuthConfiguration(registry: string, {configuration, ident}: {configuration: Configuration, ident?: Ident}): MapLike {
  const scopeConfiguration = ident && getScopeConfiguration(ident.scope, {configuration});

  if (scopeConfiguration?.get(`npmAuthIdent`) || scopeConfiguration?.get(`npmAuthToken`))
    return scopeConfiguration;

  const registryConfiguration = getRegistryConfiguration(registry, {configuration});

  return registryConfiguration || configuration;
}

export type ShouldExcludeCandidateOptions = {
  configuration: Configuration;
  descriptor: Descriptor;
  version: string;
  publishTimes: Record<string, string>;
};

export function shouldExcludeCandidate({configuration, descriptor, version, publishTimes}: ShouldExcludeCandidateOptions) {
  const range = descriptor.range.slice(PROTOCOL.length);
  const minimalAgeGate = configuration.get(`npmMinimalAgeGate`);
  if (minimalAgeGate) {
    const preapprovedPackages = configuration.get(`npmPreapprovedPackages`);
    const shouldExclude = preapprovedPackages.some(exclude =>
      structUtils.stringifyIdent(descriptor) === exclude
      || structUtils.stringifyLocator(structUtils.makeLocator(descriptor, version)) === exclude
      || structUtils.stringifyLocator(structUtils.makeLocator(descriptor, `${PROTOCOL}:${version}`)) === exclude
      || micromatch.isMatch(structUtils.stringifyDescriptor({...descriptor, range}), exclude)
      || micromatch.isMatch(structUtils.stringifyDescriptor(descriptor), exclude),
    );
    if (!shouldExclude) {
      const versionTime = new Date(publishTimes[version]);
      const ageMinutes = (new Date().getTime() - versionTime.getTime()) / 60 / 1000;
      if (ageMinutes < minimalAgeGate) {
        return true;
      }
    }
  }
  return false;
}
