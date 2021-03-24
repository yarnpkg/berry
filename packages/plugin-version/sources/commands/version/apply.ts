import {BaseCommand, WorkspaceRequiredError} from '@yarnpkg/cli';
import {Cache, Configuration}                from '@yarnpkg/core';
import {Project, StreamReport}               from '@yarnpkg/core';
import {Command, Option, Usage}              from 'clipanion';

import * as versionUtils                     from '../../versionUtils';

// eslint-disable-next-line arca/no-default-export
export default class VersionApplyCommand extends BaseCommand {
  static paths = [
    [`version`, `apply`],
  ];

  static usage: Usage = Command.Usage({
    category: `Release-related commands`,
    description: `apply all the deferred version bumps at once`,
    details: `
      This command will apply the deferred version changes (scheduled via \`yarn version major|minor|patch\`) on the current workspace (or all of them if \`--all\`) is specified.

      It will also update the \`workspace:\` references across all your local workspaces so that they keep refering to the same workspace even after the version bump.
    `,
    examples: [[
      `Apply the version change to the local workspace`,
      `yarn version apply`,
    ], [
      `Apply the version change to all the workspaces in the local workspace`,
      `yarn version apply --all`,
    ]],
  });

  all = Option.Boolean(`--all`, false, {
    description: `Apply the deferred version changes on all workspaces`,
  });

  json = Option.Boolean(`--json`, false, {
    description: `Format the output as an NDJSON stream`,
  });

  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project, workspace} = await Project.find(configuration, this.context.cwd);
    const cache = await Cache.find(configuration);

    if (!workspace)
      throw new WorkspaceRequiredError(project.cwd, this.context.cwd);

    await project.restoreInstallState({
      restoreResolutions: false,
    });

    const applyReport = await StreamReport.start({
      configuration,
      json: this.json,
      stdout: this.context.stdout,
    }, async report => {
      let releases = await versionUtils.resolveVersionFiles(project);

      if (!this.all) {
        const release = releases.get(workspace);
        if (typeof release === `undefined`)
          return;

        releases = new Map([[
          workspace,
          release,
        ]]);
      }

      await versionUtils.applyReleases(project, releases, {report});

      if (this.all)
        await versionUtils.clearVersionFiles(project);
      else
        await versionUtils.updateVersionFiles(project);

      await project.install({cache, report});
    });

    return applyReport.exitCode();
  }
}
