import {Configuration, Project} from '@yarnpkg/core';
import {PortablePath}           from '@yarnpkg/fslib';

import {WorkspaceRequiredError} from './WorkspaceRequiredError';

export async function openWorkspace(configuration: Configuration, cwd: PortablePath) {
  const {workspace} = await Project.find(configuration, cwd);
  if (!workspace)
    throw new WorkspaceRequiredError(cwd);

  return workspace;
}
