import {BaseCommand, WorkspaceRequiredError}                                   from '@yarnpkg/cli';
import type {Workspace}                                                        from '@yarnpkg/core';
import {Cache, Configuration, MessageName, Project, StreamReport, structUtils} from '@yarnpkg/core';
import {Command, Option, Usage, UsageError}                                    from 'clipanion';
import semver                                                                  from 'semver';

import * as versionUtils                                                       from '../versionUtils';

// eslint-disable-next-line arca/no-default-export
export default class VersionCommand extends BaseCommand {
  static paths = [
    [`version`],
  ];

  static usage: Usage = Command.Usage({
    category: `Release-related commands`,
    description: `apply a new version to the current package`,
    details: `
      This command will bump the version number for the given package, following the specified strategy:

      - If \`major\`, the first number from the semver range will be increased (\`X.0.0\`).
      - If \`minor\`, the second number from the semver range will be increased (\`0.X.0\`).
      - If \`patch\`, the third number from the semver range will be increased (\`0.0.X\`).
      - If prefixed by \`pre\` (\`premajor\`, ...), a \`-0\` suffix will be set (\`0.0.0-0\`).
      - If \`prerelease\`, the suffix will be increased (\`0.0.0-X\`); the third number from the semver range will also be increased if there was no suffix in the previous version.
      - If \`decline\`, the nonce will be increased for \`yarn version check\` to pass without version bump.
      - If a valid semver range, it will be used as new version.
      - If unspecified, Yarn will ask you for guidance.

      For more information about the \`--deferred\` flag, consult our documentation (https://yarnpkg.com/features/release-workflow#deferred-versioning).
    `,
    examples: [[
      `Immediately bump the version to the next major`,
      `yarn version major`,
    ], [
      `Prepare the version to be bumped to the next major`,
      `yarn version major --deferred`,
    ]],
  });

  deferred = Option.Boolean(`-d,--deferred`, {
    description: `Prepare the version to be bumped during the next release cycle`,
  });

  immediate = Option.Boolean(`-i,--immediate`, {
    description: `Bump the version immediately`,
  });

  all = Option.Boolean(`--all`, false, {
    description: `Bump the version of all workspaces`,
  });

  recursive = Option.Boolean(`-R,--recursive`, {
    description: `Bump the version of dependent workspaces as well`,
  });

  dryRun = Option.Boolean(`--dry-run`, false, {
    description: `Print the versions without actually bumping versions`,
  });

  prerelease = Option.String(`--prerelease`, {
    description: `Add a prerelease identifier to new versions`,
    tolerateBoolean: true,
  });

  exact = Option.Boolean(`--exact`, false, {
    description: `When updating parent workspaces' dependencies, use exact versions of bumped workspaces, removing any range.`,
  });

  json = Option.Boolean(`--json`, false, {
    description: `Format the output as an NDJSON stream`,
  });

  strategy = Option.String();

  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project, workspace: currentWorkspace} = await Project.find(configuration, this.context.cwd);

    if (!currentWorkspace)
      throw new WorkspaceRequiredError(project.cwd, this.context.cwd);

    let workspaces: Iterable<Workspace> = [currentWorkspace];
    if (this.all)
      workspaces = project.workspaces;
    else if (this.recursive)
      workspaces = currentWorkspace.getRecursiveWorkspaceDependents();

    let deferred = configuration.get(`preferDeferredVersions`);
    if (this.deferred)
      deferred = true;
    if (this.immediate)
      deferred = false;

    const isSemver = semver.valid(this.strategy);
    const isDeclined = this.strategy === versionUtils.Decision.DECLINE;

    const releases = new Map<Workspace, string>();
    if (isSemver) {
      for (const workspace of workspaces) {
        if (workspace.manifest.version !== null && deferred) {
          const suggestedStrategy = versionUtils.suggestStrategy(workspace.manifest.version, this.strategy);

          if (suggestedStrategy !== null) {
            releases.set(workspace, suggestedStrategy);
          } else {
            releases.set(workspace, this.strategy);
          }
        } else {
          releases.set(workspace, this.strategy);
        }
      }
    } else {
      for (const workspace of workspaces) {
        const currentVersion = workspace.manifest.version;

        if (!isDeclined) {
          if (currentVersion === null)
            throw new UsageError(`Can't bump the version if there wasn't a version to begin with - use 0.0.0 as initial version then run the command again.`);

          if (typeof currentVersion !== `string` || !semver.valid(currentVersion)) {
            throw new UsageError(`Can't bump the version (${currentVersion}) if it's not valid semver`);
          }
        }

        releases.set(workspace, versionUtils.validateReleaseDecision(this.strategy));
      }
    }

    if (deferred) {
      const versionFile = await versionUtils.openVersionFile(project, {allowEmpty: true});
      for (const [workspace, strategy] of releases)
        versionFile.releases.set(workspace, strategy);

      await versionFile.saveAll();

      return 0;
    }

    await project.restoreInstallState({
      restoreResolutions: false,
    });

    const prerelease = this.prerelease
      ? typeof this.prerelease !== `boolean` ? this.prerelease : `rc.%n`
      : null;

    const storedVersions = await versionUtils.resolveVersionFiles(project, {prerelease});
    for (const [workspace, strategy] of releases) {
      const storedVersion = storedVersions.get(workspace);
      if (strategy !== versionUtils.Decision.DECLINE) {
        const newVersion = versionUtils.applyStrategy(workspace.manifest.version, strategy, prerelease);
        if (typeof storedVersion !== `undefined` && semver.lt(newVersion, storedVersion))
          throw new UsageError(`Can't bump the version to one that would be lower than the current deferred one (${storedVersion})`);

        releases.set(workspace, newVersion);
      } else if (typeof storedVersion !== `undefined`) {
        releases.set(workspace, storedVersion);
      } else {
        releases.delete(workspace);
      }
    }

    const report = await StreamReport.start({
      configuration,
      json: this.json,
      stdout: this.context.stdout,
    }, async report => {
      for (const workspace of workspaces) {
        if (!releases.has(workspace)) {
          report.reportWarning(MessageName.UNNAMED, `Workspace ${structUtils.prettyWorkspace(configuration, workspace)} doesn't seem to require a version bump.`);
        }
      }

      versionUtils.applyReleases(project, releases, {report, exact: this.exact});
      if (!this.dryRun) {
        if (this.all) {
          await versionUtils.clearVersionFiles(project);
        } else {
          await versionUtils.updateVersionFiles(project, [...workspaces]);
        }
      }

      report.reportSeparator();
    });

    if (this.dryRun || report.hasErrors())
      return report.exitCode();

    return await project.installWithNewReport({
      json: this.json,
      stdout: this.context.stdout,
    }, {
      cache: await Cache.find(configuration),
    });
  }
}
