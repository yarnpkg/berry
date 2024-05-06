import {Descriptor, Plugin, Workspace, ResolveOptions, Manifest, AllDependencies, SettingsType} from '@yarnpkg/core';
import {structUtils, ThrowReport, miscUtils, semverUtils}                                       from '@yarnpkg/core';
import {ppath, xfs}                                                                             from '@yarnpkg/fslib';
import {Hooks as EssentialsHooks}                                                               from '@yarnpkg/plugin-essentials';
import {suggestUtils}                                                                           from '@yarnpkg/plugin-essentials';
import {Hooks as PackHooks}                                                                     from '@yarnpkg/plugin-pack';
import semver                                                                                   from 'semver';

import {hasDefinitelyTyped}                                                                     from './typescriptUtils';

const getTypesName = (descriptor: Descriptor) => {
  return descriptor.scope
    ? `${descriptor.scope}__${descriptor.name}`
    : `${descriptor.name}`;
};

const afterWorkspaceDependencyAddition = async (
  workspace: Workspace,
  dependencyTarget: suggestUtils.Target,
  descriptor: Descriptor,
  strategies: Array<suggestUtils.Strategy>,
) => {
  if (descriptor.scope === `types`)
    return;

  const {project} = workspace;
  const {configuration} = project;

  const tsEnableAutoTypes = configuration.get(`tsEnableAutoTypes`) ?? (
    xfs.existsSync(ppath.join(workspace.cwd, `tsconfig.json`))
      || xfs.existsSync(ppath.join(project.cwd, `tsconfig.json`))
  );

  if (!tsEnableAutoTypes)
    return;

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
  if (!semverUtils.validRange(range)) {
    const normalizedDescriptor = configuration.normalizeDependency(descriptor);
    const originalCandidates = await resolver.getCandidates(normalizedDescriptor, {}, resolveOptions);

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
      const normalizedAtTypesDescriptor = configuration.normalizeDependency(atTypesDescriptor);
      const atTypesCandidates = await resolver.getCandidates(normalizedAtTypesDescriptor, {}, resolveOptions);
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

  const {project} = workspace;
  const {configuration} = project;

  const tsEnableAutoTypes = configuration.get(`tsEnableAutoTypes`) ?? (
    xfs.existsSync(ppath.join(workspace.cwd, `tsconfig.json`))
      || xfs.existsSync(ppath.join(project.cwd, `tsconfig.json`))
  );

  if (!tsEnableAutoTypes)
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

declare module '@yarnpkg/core' {
  interface ConfigurationValueMap {
    tsEnableAutoTypes: boolean | null;
  }
}

const plugin: Plugin<EssentialsHooks & PackHooks> = {
  configuration: {
    tsEnableAutoTypes: {
      description: `Whether Yarn should auto-install @types/ dependencies on 'yarn add'`,
      type: SettingsType.BOOLEAN,
      isNullable: true,
      default: null,
    },
  },
  hooks: {
    afterWorkspaceDependencyAddition,
    afterWorkspaceDependencyRemoval,
    beforeWorkspacePacking,
  },
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
