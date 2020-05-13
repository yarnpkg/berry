import {Cache, Descriptor, Plugin, Workspace, ResolveOptions} from '@yarnpkg/core';
import {structUtils, ThrowReport, DescriptorHash, Package}    from '@yarnpkg/core';
import {Hooks as EssentialsHooks}                             from '@yarnpkg/plugin-essentials';
import {suggestUtils}                                         from '@yarnpkg/plugin-essentials';
import {Hooks as PackHooks}                                   from '@yarnpkg/plugin-pack';
import semver                                                 from 'semver';

import {hasDefinitelyTyped}                                   from './typescriptUtils';

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

  const cache = await Cache.find(configuration);
  const typesName = getTypesName(descriptor);

  const target = suggestUtils.Target.DEVELOPMENT;
  const modifier = suggestUtils.Modifier.EXACT;

  const request = structUtils.makeDescriptor(structUtils.makeIdent(`types`, typesName), `unknown`);
  const suggestions = await suggestUtils.getSuggestedDescriptors(request, {workspace, project, cache, target, modifier, strategies});

  const nonNullSuggestions = suggestions.filter(suggestion => suggestion.descriptor !== null);
  if (nonNullSuggestions.length === 0)
    return;

  let selected: Descriptor | null | undefined = null;

  // Try reusing an existing version
  if (strategies.includes(suggestUtils.Strategy.REUSE))
    selected = nonNullSuggestions.find(suggestion => suggestion.reason.startsWith(`Reuse`))?.descriptor;

  // If `strategies` doesn't include `Strategy.REUSE` or there's no existing
  // version in the project, try computing it from the base descriptor
  if (!selected) {
    let {range} = descriptor;

    // If the range is a tag, we have to resolve it into a semver version
    if (!semver.validRange(range)) {
      const originalCandidates = await resolver.getCandidates(descriptor, new Map<DescriptorHash,Package>(), resolveOptions);
      range = structUtils.parseRange(originalCandidates[0].reference).selector;
    }

    // Make a descriptor with the `^<major>` range
    // Note: semver can coerce ranges into versions
    selected = structUtils.makeDescriptor(request, suggestUtils.Modifier.CARET + semver.coerce(range)!.major);
  }

  workspace.manifest[target].set(
    selected.identHash,
    selected,
  );
};

const afterWorkspaceDependencyRemoval = async (
  workspace: Workspace,
  dependencyTarget: suggestUtils.Target,
  descriptor: Descriptor,
) => {
  if (descriptor.scope === `types`)
    return;

  const target = suggestUtils.Target.DEVELOPMENT;
  const typesName = getTypesName(descriptor);

  const ident = structUtils.makeIdent(`types`, typesName);
  const current = workspace.manifest[target].get(ident.identHash);

  if (typeof current === `undefined`)
    return;

  workspace.manifest[target].delete(ident.identHash);
};

const beforeWorkspacePacking = (workspace: Workspace, rawManifest: any) => {
  if (rawManifest.publishConfig && rawManifest.publishConfig.typings)
    rawManifest.typings = rawManifest.publishConfig.typings;

  if (rawManifest.publishConfig && rawManifest.publishConfig.types) {
    rawManifest.types = rawManifest.publishConfig.types;
  }
};

const plugin: Plugin<EssentialsHooks & PackHooks> = {
  hooks: {
    afterWorkspaceDependencyAddition,
    afterWorkspaceDependencyRemoval,
    beforeWorkspacePacking,
  },
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
