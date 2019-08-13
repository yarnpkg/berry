import {Plugin, Project, Workspace, structUtils} from '@berry/core';
import {MessageName, ReportError}                from '@berry/core';
import {PortablePath}                            from '@berry/fslib';

import pack                                      from './commands/pack';
import * as packUtils                            from './packUtils';

export {packUtils};

export interface Hooks {
  populateYarnPaths?: (
    project: Project,
    definePath: (path: PortablePath | null) => void,
  ) => Promise<void>,

  beforeWorkspacePacking?: (
    workspace: Workspace,
    rawManifest: object,
  ) => Promise<void>|void;
}

const DEPENDENCY_TYPES = [`dependencies`, `devDependencies`, `peerDependencies`];
const WORKSPACE_PROTOCOL = `workspace:`;

const beforeWorkspacePacking = (workspace: Workspace, rawManifest: any) => {
  if (rawManifest.publishConfig) {
    if (rawManifest.publishConfig.main)
      rawManifest.main = rawManifest.publishConfig.main;

    if (rawManifest.publishConfig.module)
      rawManifest.module = rawManifest.publishConfig.module;

    if (rawManifest.publishConfig.bin) {
      rawManifest.bin = rawManifest.publishConfig.bin;
    }
  }

  const project = workspace.project;

  for (const dependencyType of DEPENDENCY_TYPES) {
    for (const [identHash, descriptor] of workspace.manifest.getForScope(dependencyType)) {
      const matchingWorkspaces = project.findWorkspacesByDescriptor(descriptor);
      const range = structUtils.parseRange(descriptor.range);

      if (range.protocol !== WORKSPACE_PROTOCOL)
        continue;

      if (matchingWorkspaces.length === 0) {
        if (project.workspacesByIdent.has(identHash)) {
          throw new ReportError(MessageName.WORKSPACE_NOT_FOUND, `${structUtils.prettyDescriptor(project.configuration, descriptor)}: No local workspace found for this range`);
        }
      } else if (matchingWorkspaces.length > 1) {
        throw new ReportError(MessageName.TOO_MANY_MATCHING_WORKSPACES, `${structUtils.prettyDescriptor(project.configuration, descriptor)}: Too many workspaces match this range, please disambiguate`);
      } else {
        const [matchingWorkspace] = matchingWorkspaces;
        let versionToWrite: string;

        // For workspace:path/to/workspace and workspace:* we look up the workspace version
        if (structUtils.areDescriptorsEqual(descriptor, matchingWorkspace.anchoredDescriptor) || range.selector === `*`)
          versionToWrite = matchingWorkspace.manifest.version!;
        else
          // for workspace:version we simply strip the protocol
          versionToWrite = range.selector;


        rawManifest[dependencyType][structUtils.stringifyIdent(descriptor)] = versionToWrite;
      }
    }
  }
}

const plugin: Plugin = {
  hooks: {
    beforeWorkspacePacking,
  } as Hooks,
  commands: [
    pack,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
