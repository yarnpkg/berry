import {Cache, CommandContext, Configuration, Project, Workspace} from '@yarnpkg/core';
import {Command, Option}                                          from 'clipanion';

import {WorkspaceRequiredError}                                   from './WorkspaceRequiredError';

export type InstallState = {
  project: Project;
  cache: Cache;
  configuration: Configuration;
  workspace: Workspace;
};

export abstract class BaseCommand extends Command<CommandContext> {
  cwd = Option.String(`--cwd`, {hidden: true});

  abstract execute(): Promise<number | void>;

  protected async getInstallState(): Promise<InstallState> {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project, workspace} = await Project.find(configuration, this.context.cwd);
    const cache = await Cache.find(configuration);

    if (!workspace)
      throw new WorkspaceRequiredError(project.cwd, this.context.cwd);

    await project.restoreInstallState({
      restoreResolutions: false,
    });
    return {configuration, project, cache, workspace};
  }
}
