import {BaseCommand, WorkspaceRequiredError}                                   from '@yarnpkg/cli';
import type {Workspace}                                                        from '@yarnpkg/core';
import {Cache, Configuration, MessageName, Project, StreamReport, structUtils} from '@yarnpkg/core';
import {npath}                                                                 from '@yarnpkg/fslib';
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
    description: `change versions of workspaces`,
    details: `
      This command will bump the version of the current workspace, according to the given strategy:

      - If it is a valid semver, it will be used as the new version. (build metadata is stripped)
      - The \`major\`, \`minor\`, and \`patch\` strategies will bump to the next semver-major, semver-minor, or semver-patch version, respectively.
      - The \`prepatch\` strategy will only increment the prerelease identifier if the current version is already a prerelease of a semver-patch or higher level bump. Otherwise, the new version is calculated by adding prerelease identifier(s) to the next semver-patch version.
      - The \`preminor\` and \`premajor\` strategies works similarly to \`prepatch\`, but for semver-minor and semver-major versions, respectively.
      - The \`prerelease\` strategy will only increment the prerelease identifier if the current version is already a prerelease. Otherwise, it is equivalent to \`prepatch\`.
      - The \`decline\` strategy will not bump versions at all. It is mostly for use with deferred versioning.

      By default, the version bump will only apply to the current workspace. If \`--all\` is set, the version bump will be applied to all workspaces in the project. If \`--recursive\` is set, the version bump will be applied to the current workspace and all workspaces that depend on it (directly or transitively).

      Any workspace that depends on the bumped workspace(s) via \`workspace:\` dependencies will be updated to point to the new version if possible, and any range operators will be preserved. If \`--exact\` is set, the exact version of each bumped workspace will be used instead, removing any range operator.

      If \`--dry-run\` is set, the command will print the new versions the workspace(s) would be bumped to without actually bumping them.

      Attempting to bump a workspace to a lower version than its current one will throw an error unless \`--force\` is set. Note that when using deferred versioning, \`--force\` is needed twice: once when recording the deferred version bump, and again when applying it.

      ### Prerelease identifiers

      By default, incrementing an existing prerelease identifier will increment the last numeric component, and \`-0\` will be used when adding a prerelease identifier to a non-prerelease version.

      The \`--prerelease\` option can be used to specify a prerelease pattern to use. In the pattern, \`%n\` can be used to specify an incrementing numeric component. When incrementing an existing prerelease identifier, it will be matched agains the pattern. If the pattern matches, all components matched by \`%n\` will be incremented. If the pattern doesn't match, or if a prerelease identifier is being added to a non-prerelease version, the \`%n\` components will be set to 1.

      If the \`--prerelease\` option is set without a value, the default pattern of \`rc.%n\` will be used.

      ### Immediate vs deferred versioning

      By default, the version bump will be applied immediately. If the \`--deferred\` flag or the \`preferDeferredVersions\` configuration option is set, deferred versioning will be used instead. The version bump will only be recorded, and can be applied in the future by running \`yarn version apply\`. The \`--immediate\` flag can be used to force immediate mode even if \`preferDeferredVersions\` is set.

      An immediate version bump can be applied to workspaces for which deferred records exist. However, attempting to bump to a version that is lower than the recorded deferred bump will throw an error unless \`--force\` is set. After the immediate bump, deferred records for the bumped workspace(s) will be consumed.

      For more information on deferred versioning, see our documentation (https://yarnpkg.com/features/release-workflow#deferred-versioning).
    `,
    examples: [[
      `Immediately bump the version to the next major`,
      `yarn version major`,
    ], [
      `Prepare the version to be bumped to the next major`,
      `yarn version major --deferred`,
    ], [
      `Bump to beta version of the next major version`,
      `yarn version premajor --prerelease=beta.%n`,
    ]],
  });

  deferred = Option.Boolean(`-d,--deferred`, {
    description: `Record the release strategy only`,
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

  exact = Option.Boolean(`--exact`, false, {
    description: `When updating parent workspaces' dependencies, use exact versions of bumped workspaces, removing any range.`,
  });

  prerelease = Option.String(`--prerelease`, {
    description: `Specify a prerelease pattern to use when working with prerelease versions`,
    tolerateBoolean: true,
  });

  dryRun = Option.Boolean(`--dry-run`, false, {
    description: `Print version(s)/record(s) without actually bumping versions or recording deferred releases`,
  });

  force = Option.Boolean(`--force`, false, {
    description: `Bypass check for bumping to a lower version than the current/deferred one`,
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

    let workspaces: Array<Workspace> = [currentWorkspace];
    if (this.all) {
      workspaces = project.workspaces;
    } else if (this.recursive) {
      workspaces = [
        currentWorkspace,
        ...currentWorkspace.getRecursiveWorkspaceDependencies(),
      ];
    }

    const deferred = (configuration.get(`preferDeferredVersions`) || this.deferred) && !this.immediate;

    const releases = new Map<Workspace, string>();
    if (semver.valid(this.strategy)) {
      const retrograde = new Set<Workspace>();

      for (const workspace of workspaces) {
        releases.set(workspace, this.strategy);
        if (workspace.manifest.version !== null && semver.lt(this.strategy, workspace.manifest.version)) {
          retrograde.add(workspace);
        }
      }

      if (retrograde.size > 0) {
        await StreamReport.start({
          configuration,
          json: this.json,
          stdout: this.context.stdout,
        }, async report => {
          for (const workspace of retrograde) {
            if (this.force) {
              report.reportWarning(MessageName.UNNAMED, `Bumping ${structUtils.prettyWorkspace(configuration, workspace)} to a lower version (${this.strategy}) than the current one (${workspace.manifest.version})`);
            } else {
              report.reportError(MessageName.UNNAMED, `Cannot bump ${structUtils.prettyWorkspace(configuration, workspace)} to a lower version (${this.strategy}) than the current one (${workspace.manifest.version}).`);
            }
          }
        });

        if (!this.force) {
          return 1;
        }
      }
    } else {
      for (const workspace of workspaces) {
        const currentVersion = workspace.manifest.version;

        if (this.strategy !== versionUtils.Decision.DECLINE) {
          if (currentVersion === null)
            throw new UsageError(`Can't bump the version if there wasn't a version to begin with - set an initial version then run the command again.`);

          if (typeof currentVersion !== `string` || !semver.valid(currentVersion)) {
            throw new UsageError(`Can't bump the version (${currentVersion}) if it's not valid semver`);
          }
        }

        releases.set(workspace, versionUtils.validateReleaseDecision(this.strategy));
      }
    }

    if (deferred) {
      const versionFile = await versionUtils.openVersionFile(project, {allowEmpty: true});

      if (!this.dryRun) {
        for (const [workspace, strategy] of releases)
          versionFile.releases.set(workspace, strategy);

        await versionFile.saveAll();
      } else {
        await StreamReport.start({
          configuration,
          json: this.json,
          stdout: this.context.stdout,
        }, async report => {
          for (const [workspace, strategy] of releases) {
            report.reportInfo(MessageName.UNNAMED, `Recording release for ${structUtils.prettyWorkspace(configuration, workspace)}: ${strategy}`);
            report.reportJson({
              cwd: npath.fromPortablePath(workspace.cwd),
              ident: workspace.manifest.name !== null ? structUtils.stringifyIdent(workspace.manifest.name) : null,
              deferred: true,
              strategy,
            });
          }
        });
      }

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
        if (typeof storedVersion !== `undefined` && semver.lt(newVersion, storedVersion) && !this.force)
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
        const release = releases.get(workspace);
        const storedVersion = storedVersions.get(workspace);

        if (release === undefined) {
          report.reportWarning(MessageName.UNNAMED, `Workspace ${structUtils.prettyWorkspace(configuration, workspace)} doesn't seem to require a version bump.`);
        } else if (typeof storedVersion !== `undefined` && semver.lt(release, storedVersion)) {
          // This can only be reached with --force
          report.reportWarning(MessageName.UNNAMED, `Bumping ${structUtils.prettyWorkspace(configuration, workspace)} to a lower version (${release}) than the current deferred one (${storedVersion})`);
        } else if (workspace.manifest.version !== null && semver.lt(release, workspace.manifest.version)) {
          if (this.force) {
            report.reportWarning(MessageName.UNNAMED, `Bumping ${structUtils.prettyWorkspace(configuration, workspace)} to a lower version (${release}) than the current one (${workspace.manifest.version})`);
          } else {
            report.reportError(MessageName.UNNAMED, `Cannot bump ${structUtils.prettyWorkspace(configuration, workspace)} to a lower version (${release}) than the current one (${workspace.manifest.version}).`);
          }
        }
      }

      if (report.hasErrors())
        return;

      versionUtils.applyReleases(project, releases, {report, exact: this.exact});
      if (!this.dryRun) {
        if (this.all) {
          await versionUtils.clearVersionFiles(project);
        } else {
          await versionUtils.updateVersionFiles(project, workspaces);
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
