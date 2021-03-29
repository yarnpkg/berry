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
      This command will apply the deferred version changes and remove their definitions from the repository.

      Note that if \`--prerelease\` is set, the given prerelease identifier (by default \`rc.%d\`) will be used on all new versions and the version definitions will be kept as-is.

      By default only the current workspace will be bumped, but you can configure this behavior by using one of:

      - \`--recursive\` to also apply the version bump on its dependencies
      - \`--all\` to apply the version bump on all packages in the repository

      Note that this command will also update the \`workspace:\` references across all your local workspaces, thus ensuring that they keep refering to the same workspaces even after the version bump.
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

  prerelease = Option.String(`--prerelease`, {
    description: `Optionally use a rc identifier when setting versions`,
    tolerateBoolean: true,
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
      const prerelease = this.prerelease
        ? typeof this.prerelease !== `boolean` ? this.prerelease : `rc.%n`
        : null;

      let releases = await versionUtils.resolveVersionFiles(project, {prerelease});

      if (!this.all) {
        const release = releases.get(workspace);
        if (typeof release === `undefined`)
          return;

        releases = new Map([[
          workspace,
          release,
        ]]);
      }

      versionUtils.applyReleases(project, releases, {report, prerelease});

      if (!prerelease) {
        if (this.all) {
          await versionUtils.clearVersionFiles(project);
        } else {
          await versionUtils.updateVersionFiles(project);
        }
      }

      report.reportSeparator();

      await project.install({cache, report});
    });

    return applyReport.exitCode();
  }
}
