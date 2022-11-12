import {BaseCommand, WorkspaceRequiredError}                                                  from '@yarnpkg/cli';
import {Configuration, execUtils, formatUtils, MessageName, Project, StreamReport, Workspace} from '@yarnpkg/core';
import {gitUtils}                                                                             from '@yarnpkg/plugin-git';
import {Command, Option, Usage, UsageError}                                                   from 'clipanion';
import {prompt}                                                                               from 'enquirer';
import semver                                                                                 from 'semver';

import * as versionUtils                                                                      from '../versionUtils';

const setTimeoutP = (n: number) => {
  return new Promise(resolve => {
    setTimeout(resolve, n);
  });
};

const semverColors: Record<versionUtils.ReleaseType, string> = {
  [versionUtils.ReleaseType.Patch]: `green`,
  [versionUtils.ReleaseType.Minor]: `yellow`,
  [versionUtils.ReleaseType.Major]: `red`,
};

const semverStrategies = {
  [versionUtils.ReleaseType.Patch]: `patch`,
  [versionUtils.ReleaseType.Minor]: `minor`,
  [versionUtils.ReleaseType.Major]: `major`,
} as const;

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

  init = Option.Boolean(`--init`, false, {
    description: `If true, allow running the command on workspaces that don't currently have a version`,
  });

  strategy = Option.String({
    required: false,
  });

  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project, workspace} = await Project.find(configuration, this.context.cwd);

    if (!workspace)
      throw new WorkspaceRequiredError(project.cwd, this.context.cwd);

    return await this.executeImmediate({configuration, project, workspace});
  }

  async executeImmediate({configuration, project, workspace}: {configuration: Configuration, project: Project, workspace: Workspace}) {
    let initialVersion = workspace.manifest.version;
    if (initialVersion === null) {
      if (this.init) {
        initialVersion = `0.0.0`;
      } else {
        throw new UsageError(`This workspace doesn't seem to have a version; to set one, use --init`);
      }
    }

    let runPublish = false;

    const report = await StreamReport.start({
      configuration,
      stdout: this.context.stdout,
    }, async stream => {
      let prefix = stream.formatNameWithHyperlink(MessageName.UNNAMED);
      prefix = `\x1b[0m${prefix}${prefix ? `: ` : ``}`;

      const patchBlockers: Array<number> = [];
      const minorBlockers: Array<number> = [];

      const lastUpdateHash = await gitUtils.findLastPackageJsonUpdate(workspace.cwd);
      if (lastUpdateHash) {
        const pullRequests = await gitUtils.findPullRequestsSince(lastUpdateHash, {project, workspace});
        if (pullRequests.length > 0) {
          const pullRequestsWithReleaseTypes = await Promise.all(pullRequests.map(async pullRequest => ({
            ...pullRequest,
            releaseType: await versionUtils.findPullRequestReleaseType(pullRequest, {project}),
          })));

          const haveReleaseTypes = pullRequestsWithReleaseTypes.some(pullRequest => {
            return pullRequest.releaseType !== null;
          });

          const deployablePullRequests: Array<{
            name: string;
            value: string;
          }> = [];

          for (const pullRequest of pullRequestsWithReleaseTypes) {
            const releaseTypeLabel = haveReleaseTypes
              ? pullRequest.releaseType !== null
                ? `${formatUtils.pretty(configuration, pullRequest.releaseType, semverColors[pullRequest.releaseType])} - `
                : `${formatUtils.pretty(configuration, `-----`, formatUtils.Type.NULL)} - `
              : ``;

            if (pullRequest.releaseType === versionUtils.ReleaseType.Major || pullRequest.releaseType === versionUtils.ReleaseType.Minor)
              patchBlockers.push(pullRequest.number);
            if (pullRequest.releaseType === versionUtils.ReleaseType.Minor)
              minorBlockers.push(pullRequest.number);

            deployablePullRequests.push({
              name: `${releaseTypeLabel}#${pullRequest.number} - ${pullRequest.title}`,
              value: pullRequest.hash,
            });
          }

          const {deployedPullRequests} = await prompt<{deployedPullRequests: string}>({
            type: `multiselect`,
            name: `deployedPullRequests`,
            message: `${prefix}Select the pull requests you wish to deploy (easier to select them all):`,
            required: true,
            choices: deployablePullRequests,
            initial: deployablePullRequests.map((_, index) => index) as any as number,
            // @ts-expect-error-next-line
            result(this: any, names: Array<string>) {
              return names.map(name => this.find(name).value);
            },
            onCancel: () => process.exit(130),
          });

          if (deployedPullRequests.length !== deployablePullRequests.length) {
            throw new UsageError(`Deploying a subset of the changes isn't supported at this time`);
          }
        }
      }

      const getChoice = (name: string, strategy: versionUtils.ReleaseType) => {
        const newVersion = semver.inc(initialVersion!, semverStrategies[strategy])!;
        return {name: `${name} - ${newVersion}`, value: newVersion};
      };

      const {newVersion} = await prompt<{newVersion: versionUtils.ReleaseType}>({
        type: `select`,
        name: `newVersion`,
        message: `${prefix}Please select the version you wish to release:`,
        required: true,
        choices: [
          getChoice(`Major`, versionUtils.ReleaseType.Major),
          getChoice(`Minor`, versionUtils.ReleaseType.Minor),
          getChoice(`Patch`, versionUtils.ReleaseType.Patch),
        ],
        result(this: any, values) {
          return this.find(values).value;
        },
        onCancel: () => process.exit(130),
      });

      workspace.manifest.version = newVersion;
      await workspace.persistManifest();

      await execUtils.execvp(`git`, [`commit`, `--all`, `-m`, `Release v${newVersion}`], {
        cwd: workspace.cwd,
        strict: true,
      });

      const newTags: Array<string> = [];
      for (const pattern of configuration.get(`releaseTagPatterns`)) {
        const newTag = pattern.replace(/\{version\}/g, newVersion);
        newTags.push(newTag);

        await execUtils.execvp(`git`, [`tag`, `--annotate`, `-m`, newTag, newTag], {
          cwd: workspace.cwd,
          strict: true,
        });
      }

      const commitSuccessMessage = newTags.length > 0
        ? `Release tagged as ${newTags.map(tag => formatUtils.pretty(configuration, tag, formatUtils.Type.CODE)).join(`, `)}; do you wish to publish it now?`
        : `Release committed; do you wish to publish it now?`;

      const {shouldPublish} = await prompt<{shouldPublish: boolean}>({
        type: `confirm`,
        name: `shouldPublish`,
        message: `${prefix}${commitSuccessMessage}`,
        initial: true,
        required: true,
        onCancel: () => process.exit(130),
      });

      if (!shouldPublish) {
        stream.reportInfo(MessageName.UNNAMED, `Publish step skipped`);
        return;
      }

      const newPublishCommand = workspace.manifest.scripts.has(`publish`)
        ? `yarn run publish`
        : `yarn npm publish`;

      stream.reportInfo(MessageName.UNNAMED, `Publish requested; we'll run ${formatUtils.pretty(configuration, newPublishCommand, formatUtils.Type.CODE)} in a couple of seconds`);

      await setTimeoutP(3000);

      stream.reportSeparator();
      runPublish = true;
    });

    if (report.hasErrors())
      return report.exitCode();

    if (runPublish) {
      if (workspace.manifest.scripts.has(`publish`)) {
        return await this.cli.run([`run`, `publish`]);
      } else {
        return await this.cli.run([`npm`, `publish`]);
      }
    }

    return 0;
  }
}
