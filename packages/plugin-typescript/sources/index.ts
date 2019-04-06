import {Cache, Descriptor, Plugin, Workspace} from '@berry/core';
import {httpUtils, structUtils}               from '@berry/core';
import {Hooks as EssentialsHooks}             from '@berry/plugin-essentials';
import {suggestUtils}                         from '@berry/plugin-essentials';

const afterWorkspaceDependencyAddition = async (
  workspace: Workspace,
  dependencyTarget: suggestUtils.Target,
  descriptor: Descriptor,
) => {
  if (descriptor.scope === `types`)
    return;

  const project = workspace.project;
  const configuration = project.configuration;
  const cache = await Cache.find(configuration);

  const typesName = descriptor.scope
    ? `${descriptor.scope}__${descriptor.name}`
    : `${descriptor.name}`;

  const target = suggestUtils.Target.REGULAR;
  const modifier = suggestUtils.Modifier.EXACT;
  const strategies = [suggestUtils.Strategy.LATEST];

  const request = structUtils.makeDescriptor(structUtils.makeIdent(`types`, typesName), `unknown`);
  const suggestions = await suggestUtils.getSuggestedDescriptors(request, null, {project, cache, target, modifier, strategies});

  const nonNullSuggestions = suggestions.filter(suggestion => suggestion.descriptor !== null);
  if (nonNullSuggestions.length === 0)
    return;

  const selected = nonNullSuggestions[0].descriptor;
  if (selected === null)
    return;

  workspace.manifest[target].set(
    selected.identHash,
    selected,
  );
};

const plugin: Plugin = {
  hooks: {
    afterWorkspaceDependencyAddition,
  } as (
    EssentialsHooks
  ),
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
