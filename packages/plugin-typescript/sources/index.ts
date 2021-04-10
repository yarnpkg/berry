import {structUtils, ThrowReport, miscUtils, Hooks as CoreHooks}                                           from '@yarnpkg/core';
import {Descriptor, Plugin, Workspace, ResolveOptions, Manifest, AllDependencies, DescriptorHash, Package} from '@yarnpkg/core';
import {xfs, ppath, Filename}                                                                              from "@yarnpkg/fslib";
import {suggestUtils}                                                                                      from '@yarnpkg/plugin-essentials';
import {Hooks as EssentialsHooks}                                                                          from '@yarnpkg/plugin-essentials';
import {Hooks as PackHooks}                                                                                from '@yarnpkg/plugin-pack';
import semver                                                                                              from 'semver';

import {hasDefinitelyTyped}                                                                                from './typescriptUtils';

const getTypesName = (descriptor: Descriptor) => {
  return descriptor.scope
    ? `${descriptor.scope}__${descriptor.name}`
    : `${descriptor.name}`;
};

const afterWorkspaceDependencyAddition = async (
  workspace: Workspace,
  dependencyTarget: suggestUtils.Target,
  descriptor: Descriptor,
  strategies: Array<suggestUtils.Strategy>
) => {
  if (descriptor.scope === `types`)
    return;

  const {project} = workspace;
  const {configuration} = project;

  const resolver = configuration.makeResolver();
  const resolveOptions: ResolveOptions = {
    project,
    resolver,
    report: new ThrowReport(),
  };

  const requiresInstallTypes = await hasDefinitelyTyped(descriptor, configuration);

  if (!requiresInstallTypes)
    return;

  const typesName = getTypesName(descriptor);

  let range = structUtils.parseRange(descriptor.range).selector;
  // If the range is a tag, we have to resolve it into a semver version
  if (!semver.validRange(range)) {
    const originalCandidates = await resolver.getCandidates(descriptor, new Map<DescriptorHash, Package>(), resolveOptions);
    range = structUtils.parseRange(originalCandidates[0].reference).selector;
  }

  const semverRange = semver.coerce(range);
  if (semverRange === null)
    return;

  const coercedRange = `${suggestUtils.Modifier.CARET}${semverRange!.major}`;
  const atTypesDescriptor = structUtils.makeDescriptor(structUtils.makeIdent(`types`, typesName), coercedRange);

  const projectSuggestions = miscUtils.mapAndFind(project.workspaces, workspace => {
    const regularDependencyHash = workspace.manifest.dependencies.get(descriptor.identHash)?.descriptorHash;
    const devDependencyHash = workspace.manifest.devDependencies.get(descriptor.identHash)?.descriptorHash;

    // We only want workspaces that depend the exact same range as the original package
    if (regularDependencyHash !== descriptor.descriptorHash && devDependencyHash !== descriptor.descriptorHash)
      return miscUtils.mapAndFind.skip;

    const atTypesDependencies: Array<[AllDependencies, Descriptor]> = [];

    for (const type of Manifest.allDependencies) {
      const atTypesDependency = workspace.manifest[type].get(atTypesDescriptor.identHash);
      if (typeof atTypesDependency === `undefined`)
        continue;

      atTypesDependencies.push([type, atTypesDependency]);
    }

    // We only want workspaces that also depend on the appropriate @types package
    if (atTypesDependencies.length === 0)
      return miscUtils.mapAndFind.skip;

    return atTypesDependencies;
  });

  if (typeof projectSuggestions !== `undefined`) {
    for (const [dependencyType, atTypesDescriptor] of projectSuggestions) {
      workspace.manifest[dependencyType].set(atTypesDescriptor.identHash, atTypesDescriptor);
    }
  } else {
    // Return if the atTypes descriptor can't be resolved
    try {
      const atTypesCandidates = await resolver.getCandidates(atTypesDescriptor, new Map<DescriptorHash, Package>(), resolveOptions);
      if (atTypesCandidates.length === 0) {
        return;
      }
    } catch {
      return;
    }

    workspace.manifest[suggestUtils.Target.DEVELOPMENT].set(atTypesDescriptor.identHash, atTypesDescriptor);
  }
};

const afterWorkspaceDependencyRemoval = async (
  workspace: Workspace,
  dependencyTarget: suggestUtils.Target,
  descriptor: Descriptor,
) => {
  if (descriptor.scope === `types`)
    return;

  const typesName = getTypesName(descriptor);

  const ident = structUtils.makeIdent(`types`, typesName);

  for (const type of Manifest.allDependencies) {
    const current = workspace.manifest[type].get(ident.identHash);

    if (typeof current === `undefined`)
      continue;

    workspace.manifest[type].delete(ident.identHash);
  }
};

const beforeWorkspacePacking = (workspace: Workspace, rawManifest: any) => {
  if (rawManifest.publishConfig && rawManifest.publishConfig.typings)
    rawManifest.typings = rawManifest.publishConfig.typings;

  if (rawManifest.publishConfig && rawManifest.publishConfig.types) {
    rawManifest.types = rawManifest.publishConfig.types;
  }
};

const plugin: Plugin<EssentialsHooks & PackHooks & CoreHooks> = {
  hooks: {
    async afterAllInstalled(project) {
      for (const workspace of project.workspaces) {
        const referencedWorkspaces = miscUtils.mapAndFilter(workspace.dependencies, ([identHash, descriptor]) => {
          const dependingWorkspace = project.tryWorkspaceByDescriptor(descriptor);
          if (!dependingWorkspace || dependingWorkspace === workspace)
            return miscUtils.mapAndFilter.skip;

          return ppath.relative(workspace.cwd, dependingWorkspace.cwd);
        });

        let configChanged = false;

        let tsconfig: {references?: Array<{path: string}>} = {};
        try {
          tsconfig = await xfs.readJsonPromise(ppath.join(workspace.cwd, `tsconfig.json` as Filename));
        } catch {
          configChanged = true;
        }

        if (referencedWorkspaces.length === 0) {
          if (typeof tsconfig.references !== `undefined`) {
            configChanged = true;
            tsconfig.references = undefined;
          }
        } else {
          const oldReferences = new Set(tsconfig.references?.map(ref => ref.path));

          tsconfig.references = [];

          for (const relativePath of referencedWorkspaces) {
            if (!oldReferences.has(relativePath))
              configChanged = true;

            tsconfig.references.push({path: relativePath});
          }
        }

        if (configChanged) {
          await xfs.writeJsonPromise(ppath.join(workspace.cwd, `tsconfig.json` as Filename), tsconfig);
        }
      }
    },
    afterWorkspaceDependencyAddition,
    afterWorkspaceDependencyRemoval,
    beforeWorkspacePacking,
  },
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
