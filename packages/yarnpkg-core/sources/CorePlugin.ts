import {Plugin}                   from './Plugin';
import {Project}                  from './Project';
import {Resolver, ResolveOptions} from './Resolver';
import * as structUtils           from './structUtils';
import {Descriptor, Locator}      from './types';

export const CorePlugin: Plugin = {
  hooks: {
    reduceDependency: (dependency: Descriptor, project: Project, locator: Locator, initialDependency: Descriptor, {resolver, resolveOptions}: {resolver: Resolver, resolveOptions: ResolveOptions}) => {
      for (const {pattern, reference} of project.topLevelWorkspace.manifest.resolutions) {
        if (pattern.from && pattern.from.fullName !== structUtils.requirableIdent(locator))
          continue;
        if (pattern.from && pattern.from.description && pattern.from.description !== locator.reference)
          continue;

        if (pattern.descriptor.fullName !== structUtils.requirableIdent(dependency))
          continue;
        if (pattern.descriptor.description && pattern.descriptor.description !== dependency.range)
          continue;

        const alias = resolver.bindDescriptor(
          structUtils.makeDescriptor(dependency, reference),
          project.topLevelWorkspace.anchoredLocator,
          resolveOptions,
        );

        return alias;
      }

      return dependency;
    },
  },
};
