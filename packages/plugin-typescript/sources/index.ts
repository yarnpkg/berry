import {Cache, Descriptor, Plugin, Workspace} from '@yarnpkg/core';
import {structUtils}                          from '@yarnpkg/core';
import {Hooks as EssentialsHooks}             from '@yarnpkg/plugin-essentials';
import {suggestUtils}                         from '@yarnpkg/plugin-essentials';
import {Hooks as PackHooks}                   from '@yarnpkg/plugin-pack';
import {prompt}                               from 'inquirer';

import {hasDefinitelyTyped}                   from './typescriptUtils';

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

  const project = workspace.project;
  const configuration = project.configuration;
  const requiresInstallTypes = await hasDefinitelyTyped(descriptor, configuration);

  if (!requiresInstallTypes)
    return;

  const cache = await Cache.find(configuration);
  const typesName = getTypesName(descriptor);

  const target = suggestUtils.Target.DEVELOPMENT;
  const modifier = suggestUtils.Modifier.EXACT;

  const request = structUtils.makeDescriptor(structUtils.makeIdent(`types`, typesName), `unknown`);
  const suggestions = await suggestUtils.getSuggestedDescriptors(request, {workspace, project, cache, target, modifier, strategies});

  let selected: Descriptor | null;
  let askedQuestions = false;

  const nonNullSuggestions = suggestions.filter(suggestion => suggestion.descriptor !== null);
  if (nonNullSuggestions.length === 0)
    return;

  if (nonNullSuggestions.length === 1) {
    selected = nonNullSuggestions[0].descriptor;
  } else {
    askedQuestions = true;
    ({answer: selected} = await prompt({
      type: `list`,
      name: `answer`,
      message: `Which range do you want to use?`,
      choices: suggestions.map(({descriptor, reason}) => descriptor ? {
        name: reason,
        value: descriptor as Descriptor,
        short: structUtils.prettyDescriptor(project.configuration, descriptor),
      } : {
        name: reason,
        disabled: (): boolean => true,
      }),
    }));
  }

  if (selected === null)
    return;

  if (askedQuestions)
    process.stdout.write(`\n`);

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
