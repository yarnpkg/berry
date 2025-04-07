import {Descriptor, Locator, Plugin, Project, ResolveOptions, Resolver, Workspace} from '@yarnpkg/core';
import {structUtils, semverUtils}                                                  from '@yarnpkg/core';

function normalizeJsrDependency(dependency: Descriptor) {
  if (semverUtils.validRange(dependency.range.slice(4)))
    return structUtils.makeDescriptor(dependency, `npm:${structUtils.wrapIdentIntoScope(dependency, `jsr`)}@${dependency.range.slice(4)}`);

  const parsedRange = structUtils.tryParseDescriptor(dependency.range.slice(4), true);
  if (parsedRange !== null)
    return structUtils.makeDescriptor(dependency, `npm:${structUtils.wrapIdentIntoScope(parsedRange, `jsr`)}@${parsedRange.range}`);


  return dependency;
}

function reduceDependency(dependency: Descriptor, project: Project, locator: Locator, initialDependency: Descriptor, {resolver, resolveOptions}: {resolver: Resolver, resolveOptions: ResolveOptions}) {
  return dependency.range.startsWith(`jsr:`)
    ? normalizeJsrDependency(dependency)
    : dependency;
}

const DEPENDENCY_TYPES = [`dependencies`, `devDependencies`, `peerDependencies`];

function beforeWorkspacePacking(workspace: Workspace, rawManifest: any) {
  for (const dependencyType of DEPENDENCY_TYPES) {
    for (const descriptor of workspace.manifest.getForScope(dependencyType).values()) {
      if (!descriptor.range.startsWith(`jsr:`))
        continue;

      const normalizedDescriptor = normalizeJsrDependency(descriptor);

      // Ensure optional dependencies are handled as well
      const identDescriptor = dependencyType === `dependencies`
        ? structUtils.makeDescriptor(descriptor, `unknown`)
        : null;

      const finalDependencyType = identDescriptor !== null && workspace.manifest.ensureDependencyMeta(identDescriptor).optional
        ? `optionalDependencies`
        : dependencyType;

      rawManifest[finalDependencyType][structUtils.stringifyIdent(descriptor)] = normalizedDescriptor.range;
    }
  }
}

const plugin: Plugin = {
  hooks: {
    reduceDependency,
    beforeWorkspacePacking,
  },
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
