import {Cache, Descriptor, Plugin, Workspace} from '@berry/core';
import {httpUtils, structUtils}               from '@berry/core';
import {Hooks as EssentialsHooks}             from '@berry/plugin-essentials';
import {suggestUtils}                         from '@berry/plugin-essentials';

const afterNewWorkspaceDependency = async (
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

  if (suggestions.length === 0)
    return;

  const selected = suggestions[0].descriptor;

  workspace.manifest[target].set(
    selected.identHash,
    selected,
  );
};

const plugin: Plugin = {
  hooks: {
    afterNewWorkspaceDependency,
  } as (
    EssentialsHooks
  ),
};

export default plugin;
