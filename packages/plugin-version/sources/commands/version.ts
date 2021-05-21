import {BaseCommand, WorkspaceRequiredError} from '@yarnpkg/cli';
import {Configuration, Project}              from '@yarnpkg/core';
import {Command, Option, Usage, UsageError}  from 'clipanion';
import semver                                from 'semver';

import * as versionUtils                     from '../versionUtils';

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

  strategy = Option.String();

  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project, workspace} = await Project.find(configuration, this.context.cwd);

    if (!workspace)
      throw new WorkspaceRequiredError(project.cwd, this.context.cwd);

    let deferred = configuration.get(`preferDeferredVersions`);
    if (this.deferred)
      deferred = true;
    if (this.immediate)
      deferred = false;

    const isSemver = semver.valid(this.strategy);
    const isDeclined = this.strategy === versionUtils.Decision.DECLINE;

    let releaseStrategy: string | null;
    if (isSemver) {
      if (workspace.manifest.version !== null) {
        const suggestedStrategy = versionUtils.suggestStrategy(workspace.manifest.version, this.strategy);

        if (suggestedStrategy !== null) {
          releaseStrategy = suggestedStrategy;
        } else {
          releaseStrategy = this.strategy;
        }
      } else {
        releaseStrategy = this.strategy;
      }
    } else {
      const currentVersion = workspace.manifest.version;

      if (!isDeclined) {
        if (currentVersion === null)
          throw new UsageError(`Can't bump the version if there wasn't a version to begin with - use 0.0.0 as initial version then run the command again.`);

        if (typeof currentVersion !== `string` || !semver.valid(currentVersion)) {
          throw new UsageError(`Can't bump the version (${currentVersion}) if it's not valid semver`);
        }
      }

      releaseStrategy = this.strategy;
    }

    if (!deferred) {
      const releases = await versionUtils.resolveVersionFiles(project);
      const storedVersion = releases.get(workspace);

      if (typeof storedVersion !== `undefined`) {
        const thisVersion = versionUtils.applyStrategy(workspace.manifest.version, releaseStrategy);
        if (semver.lt(thisVersion, storedVersion)) {
          throw new UsageError(`Can't bump the version to one that would be lower than the current deferred one (${storedVersion})`);
        }
      }
    }

    const versionFile = await versionUtils.openVersionFile(project, {allowEmpty: true});
    versionFile.releases.set(workspace, releaseStrategy as any);
    await versionFile.saveAll();

    if (!deferred) {
      await this.cli.run([`version`, `apply`]);
    }
  }
}
