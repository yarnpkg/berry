import type {Descriptor, Locator, Plugin, Project, Resolver, ResolveOptions} from '@yarnpkg/core';


const plugin: Plugin = {
  hooks: {
    reduceDependency: (dependency: Descriptor, project: Project, locator: Locator, initialDependency: Descriptor, {resolver, resolveOptions}: {resolver: Resolver, resolveOptions: ResolveOptions}) => {
      return dependency;
    },
  },
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
