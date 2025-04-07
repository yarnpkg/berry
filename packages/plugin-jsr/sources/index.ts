import {Descriptor, Locator, Plugin, Project, ResolveOptions, Resolver} from '@yarnpkg/core';
import {structUtils, semverUtils}                                       from '@yarnpkg/core';

function reduceDependency(dependency: Descriptor, project: Project, locator: Locator, initialDependency: Descriptor, {resolver, resolveOptions}: {resolver: Resolver, resolveOptions: ResolveOptions}) {
  if (dependency.range.startsWith(`jsr:`)) {
    if (semverUtils.validRange(dependency.range.slice(4)))
      return structUtils.makeDescriptor(dependency, `npm:${structUtils.wrapIdentIntoScope(dependency, `jsr`)}@${dependency.range.slice(4)}`);

    const parsedRange = structUtils.tryParseDescriptor(dependency.range.slice(4), true);
    if (parsedRange !== null) {
      return structUtils.makeDescriptor(dependency, `npm:${structUtils.wrapIdentIntoScope(parsedRange, `jsr`)}@${parsedRange.range}`);
    }
  }

  return dependency;
}

const plugin: Plugin = {
  hooks: {
    reduceDependency,
  },
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
