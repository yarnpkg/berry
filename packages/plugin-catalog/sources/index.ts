import {type Descriptor, type Locator, type Plugin, type Project, type Resolver, type ResolveOptions, SettingsType} from '@yarnpkg/core';

import {isCatalogReference, resolveDescriptorFromCatalog}                                                           from './utils';

declare module '@yarnpkg/core' {
  interface ConfigurationValueMap {
    catalog?: Map<string, string>;
  }
}

const plugin: Plugin = {
  configuration: {
    catalog: {
      description: `The catalog of packages`,
      type: SettingsType.MAP,
      valueDefinition: {
        description: `The catalog of packages`,
        type: SettingsType.STRING,
      },
    },
  },
  hooks: {

    reduceDependency: (dependency: Descriptor, project: Project, locator: Locator, initialDependency: Descriptor, {resolver, resolveOptions}: {resolver: Resolver, resolveOptions: ResolveOptions}) => {
      // On this hook, we will check if the dependency is a catalog reference, and if so, we will replace the range with the actual range defined in the catalog
      if (isCatalogReference(dependency.range)) {
        const resolvedDescriptor = resolveDescriptorFromCatalog(project, dependency);
        return resolvedDescriptor;
      }
      return dependency;
    },
  },
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
