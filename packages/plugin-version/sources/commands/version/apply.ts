import {BaseCommand, WorkspaceRequiredError} from '@yarnpkg/cli';
import {Cache, Configuration, MessageName}   from '@yarnpkg/core';
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

      Note that if \`--prerelease\` is set, the given prerelease identifier (by default \`rc.%n\`) will be used on all new versions and the version definitions will be kept as-is.

      By default only the current workspace will be bumped, but you can configure this behavior by using one of:

      - \`--recursive\` to also apply the version bump on its dependencies
      - \`--all\` to apply the version bump on all packages in the repository

      Note that this command will also update the \`workspace:\` references across all your local workspaces, thus ensuring that they keep referring to the same workspaces even after the version bump.
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

  dryRun = Option.Boolean(`--dry-run`, false, {
    description: `Print the versions without actually generating the package archive`,
  });

  prerelease = Option.String(`--prerelease`, {
    description: `Add a prerelease identifier to new versions`,
    tolerateBoolean: true,
  });

  recursive = Option.Boolean(`-R,--recursive`, {
    description: `Release the transitive workspaces as well`,
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

      const allReleases = await versionUtils.resolveVersionFiles(project, {prerelease});
      let filteredReleases: typeof allReleases = new Map();

      if (this.all) {
        filteredReleases = allReleases;
      } else {
        const relevantWorkspaces = this.recursive
          ? workspace.getRecursiveWorkspaceDependencies()
          : [workspace];

        for (const child of relevantWorkspaces) {
          const release = allReleases.get(child);
          if (typeof release !== `undefined`) {
            filteredReleases.set(child, release);
          }
        }
      }

      if (filteredReleases.size === 0) {
        const protip = allReleases.size > 0
          ? ` Did you want to add --all?`
          : ``;

        report.reportWarning(MessageName.UNNAMED, `The current workspace doesn't seem to require a version bump.${protip}`);
        return;
      }

      versionUtils.applyReleases(project, filteredReleases, {report});

      if (!this.dryRun) {
        if (!prerelease) {
          if (this.all) {
            await versionUtils.clearVersionFiles(project);
          } else {
            await versionUtils.updateVersionFiles(project, [...filteredReleases.keys()]);
          }
        }

        report.reportSeparator();
      }
    });

    if (this.dryRun || applyReport.hasErrors())
      return applyReport.exitCode();

    return await project.installWithNewReport({
      json: this.json,
      stdout: this.context.stdout,
    }, {
      cache,
    });
  }
}
