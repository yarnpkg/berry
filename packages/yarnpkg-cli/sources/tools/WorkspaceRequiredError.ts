import {Manifest}            from '@yarnpkg/core';
import {PortablePath, ppath} from '@yarnpkg/fslib';
import {UsageError}          from 'clipanion';

export class WorkspaceRequiredError extends UsageError {
  constructor(projectCwd: PortablePath, cwd: PortablePath) {
    const relativePath = ppath.relative(projectCwd, cwd);
    const manifestPath = ppath.join(projectCwd, Manifest.fileName);

    super(`This command can only be run from within a workspace of your project (${relativePath} isn't a workspace of ${manifestPath}).`);
  }
}
