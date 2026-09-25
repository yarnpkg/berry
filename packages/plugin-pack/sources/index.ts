import {Hooks as CoreHooks, Plugin, Workspace, structUtils} from '@yarnpkg/core';
import {MessageName, ReportError}                           from '@yarnpkg/core';

import PackCommand                                          from './commands/pack';
import * as packUtils                                       from './packUtils';

export {PackCommand};
export {packUtils};

export interface Hooks {
  /**
   * Called before a workspace is packed. The `rawManifest` value passed in
   * parameter is allowed to be mutated at will, with the changes being only
   * applied to the packed manifest (the original one won't be mutated).
   */
  beforeWorkspacePacking?: (
    workspace: Workspace,
    rawManifest: object,
  ) => Promise<void> | void;
}

const DEPENDENCY_TYPES = [`dependencies`, `devDependencies`, `peerDependencies`];
const PUBLISHED_DEPENDENCY_TYPES = [`dependencies`, `peerDependencies`];
const WORKSPACE_PROTOCOL = `workspace:`;
const PATCH_PROTOCOL = `patch:`;

const beforeWorkspacePacking = (workspace: Workspace, rawManifest: any) => {
  if (rawManifest.publishConfig) {
    if (rawManifest.publishConfig.type)
      rawManifest.type = rawManifest.publishConfig.type;

    if (rawManifest.publishConfig.main)
      rawManifest.main = rawManifest.publishConfig.main;

    if (rawManifest.publishConfig.browser)
      rawManifest.browser = rawManifest.publishConfig.browser;

    if (rawManifest.publishConfig.module)
      rawManifest.module = rawManifest.publishConfig.module;

    if (rawManifest.publishConfig.exports)
      rawManifest.exports = rawManifest.publishConfig.exports;

    if (rawManifest.publishConfig.imports)
      rawManifest.imports = rawManifest.publishConfig.imports;

    if (rawManifest.publishConfig.bin) {
      rawManifest.bin = rawManifest.publishConfig.bin;
    }
  }

  const project = workspace.project;

  if (!workspace.manifest.private) {
    for (const dependencyType of PUBLISHED_DEPENDENCY_TYPES) {
      for (const descriptor of workspace.manifest.getForScope(dependencyType).values()) {
        if (descriptor.range.startsWith(PATCH_PROTOCOL)) {
          throw new ReportError(MessageName.UNPUBLISHABLE_DEPENDENCY, `${structUtils.prettyDescriptor(project.configuration, descriptor)}: The patch: protocol can't be used in the dependencies of a published package, since consumers won't have access to the patch file; apply it through the resolutions field of the project root instead`);
        }
      }
    }
  }

  for (const dependencyType of DEPENDENCY_TYPES) {
    for (const descriptor of workspace.manifest.getForScope(dependencyType).values()) {
      const matchingWorkspace = project.tryWorkspaceByDescriptor(descriptor);
      const range = structUtils.parseRange(descriptor.range);

      if (range.protocol !== WORKSPACE_PROTOCOL)
        continue;

      if (matchingWorkspace === null) {
        if (project.tryWorkspaceByIdent(descriptor) === null) {
          throw new ReportError(MessageName.WORKSPACE_NOT_FOUND, `${structUtils.prettyDescriptor(project.configuration, descriptor)}: No local workspace found for this range`);
        }
      } else {
        let versionToWrite: string;

        // For workspace:path/to/workspace and workspace:* we look up the workspace version
        if (structUtils.areDescriptorsEqual(descriptor, matchingWorkspace.anchoredDescriptor) || range.selector === `*`)
          versionToWrite = matchingWorkspace.manifest.version ?? `0.0.0`;
        // For workspace:~ and workspace:^ we add the selector in front of the workspace version
        else if (range.selector === `~` || range.selector === `^`)
          versionToWrite =  `${range.selector}${matchingWorkspace.manifest.version ?? `0.0.0`}`;
        else
          // for workspace:version we simply strip the protocol
          versionToWrite = range.selector;

        // Ensure optional dependencies are handled as well
        const identDescriptor = dependencyType === `dependencies`
          ? structUtils.makeDescriptor(descriptor, `unknown`)
          : null;
        const finalDependencyType = identDescriptor !== null && workspace.manifest.ensureDependencyMeta(identDescriptor).optional
          ? `optionalDependencies`
          : dependencyType;
        rawManifest[finalDependencyType][structUtils.stringifyIdent(descriptor)] = versionToWrite;
      }
    }
  }
};

const plugin: Plugin<CoreHooks & Hooks> = {
  hooks: {
    beforeWorkspacePacking,
  },
  commands: [
    PackCommand,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin as Plugin;
