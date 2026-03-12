import {type Descriptor, type Locator, type Plugin, type Project, type Resolver, type ResolveOptions, type Workspace, SettingsType, structUtils, Manifest, ThrowReport} from '@yarnpkg/core';
import {Hooks as CoreHooks}                                                                                                                                             from '@yarnpkg/core';
import {Hooks as PackHooks}                                                                                                                                             from '@yarnpkg/plugin-pack';

import {isCatalogReference, resolveDescriptorFromCatalog}                                                                                                               from './utils';

declare module '@yarnpkg/core' {
  interface ConfigurationValueMap {
    catalog: Map<string, string>;
    catalogs: Map<string, Map<string, string>>;
  }
}


const plugin: Plugin<CoreHooks & PackHooks> = {
  configuration: {
    /**
     * Example:
     * ```yaml
     * catalog:
     *   react: ^18.3.1
     *   lodash: ^4.17.21
     * ```
     */
    catalog: {
      description: `The default catalog of packages`,
      type: SettingsType.MAP,
      valueDefinition: {
        description: `The catalog of packages`,
        type: SettingsType.STRING,
      },
    },
    /**
     * Example:
     * ```yaml
     * catalogs:
     *   react18:
     *     react: ^18.3.1
     *     react-dom: ^18.3.1
     *   react17:
     *     react: ^17.0.2
     *     react-dom: ^17.0.2
     * ```
     */
    catalogs: {
      description: `Named catalogs of packages`,
      type: SettingsType.MAP,
      valueDefinition: {
        description: `A named catalog`,
        type: SettingsType.MAP,
        valueDefinition: {
          description: `Package version in the catalog`,
          type: SettingsType.STRING,
        },
      },
    },
  },
  hooks: {
    /**
     * To allow publishing packages with catalog references, we need to replace the
     * catalog references with the actual version ranges during the packing phase.
     */
    beforeWorkspacePacking: (workspace: Workspace, rawManifest: any) => {
      const project = workspace.project;

      // Create resolver and resolveOptions from the project configuration
      const resolver = project.configuration.makeResolver();
      const resolveOptions: ResolveOptions = {
        project,
        resolver,
        report: new ThrowReport(), // Simple report implementation for internal resolution
      };

      for (const dependencyType of Manifest.allDependencies) {
        const dependencies = rawManifest[dependencyType];
        if (!dependencies) continue;

        for (const [identStr, range] of Object.entries(dependencies)) {
          if (typeof range !== `string` || !isCatalogReference(range)) continue;

          // Create a descriptor to resolve from catalog
          const ident = structUtils.parseIdent(identStr);
          const descriptor = structUtils.makeDescriptor(ident, range);

          // Resolve the catalog reference to get the actual version range
          const resolvedDescriptor = resolveDescriptorFromCatalog(project, descriptor, resolver, resolveOptions);

          let {protocol, source, params, selector} = structUtils.parseRange(structUtils.convertToManifestRange(resolvedDescriptor.range));
          if (protocol === workspace.project.configuration.get(`defaultProtocol`))
            protocol = null;

          // Replace the catalog reference with the resolved range
          dependencies[identStr] = structUtils.makeRange({protocol, source, params, selector});
        }
      }
    },

    /**
     * On this hook, we will check if the dependency is a catalog reference, and if so,
     * we will replace the range with the actual range defined in the catalog.
     */
    reduceDependency: async (dependency: Descriptor, project: Project, locator: Locator, initialDependency: Descriptor, {resolver, resolveOptions}: {resolver: Resolver, resolveOptions: ResolveOptions}) => {
      if (isCatalogReference(dependency.range)) {
        const resolvedDescriptor = resolveDescriptorFromCatalog(project, dependency, resolver, resolveOptions);
        return resolvedDescriptor;
      }
      return dependency;
    },
  },
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
