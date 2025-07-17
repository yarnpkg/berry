import {BaseCommand, WorkspaceRequiredError}                                                    from '@yarnpkg/cli';
import {Configuration, MessageName, Project, ReportError, StreamReport, scriptUtils, miscUtils} from '@yarnpkg/core';
import {npmConfigUtils, npmHttpUtils, npmPublishUtils}                                          from '@yarnpkg/plugin-npm';
import {packUtils}                                                                              from '@yarnpkg/plugin-pack';
import {Command, Option, Usage, UsageError}                                                     from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default class NpmPublishCommand extends BaseCommand {
  static paths = [
    [`npm`, `publish`],
  ];

  static usage: Usage = Command.Usage({
    category: `Npm-related commands`,
    description: `publish the active workspace to the npm registry`,
    details: `
      This command will pack the active workspace into a fresh archive and upload it to the npm registry.

      The package will by default be attached to the \`latest\` tag on the registry, but this behavior can be overridden by using the \`--tag\` option.

      Note that for legacy reasons scoped packages are by default published with an access set to \`restricted\` (aka "private packages"). This requires you to register for a paid npm plan. In case you simply wish to publish a public scoped package to the registry (for free), just add the \`--access public\` flag. This behavior can be enabled by default through the \`npmPublishAccess\` settings.
    `,
    examples: [[
      `Publish the active workspace`,
      `yarn npm publish`,
    ]],
  });

  access = Option.String(`--access`, {
    description: `The access for the published package (public or restricted)`,
  });

  tag = Option.String(`--tag`, `latest`, {
    description: `The tag on the registry that the package should be attached to`,
  });

  tolerateRepublish = Option.Boolean(`--tolerate-republish`, false, {
    description: `Warn and exit when republishing an already existing version of a package`,
  });

  otp = Option.String(`--otp`, {
    description: `The OTP token to use with the command`,
  });

  provenance = Option.Boolean(`--provenance`, false, {
    description: `Generate provenance for the package. Only available in GitHub Actions and GitLab CI. Can be set globally through the \`npmPublishProvenance\` setting or the \`YARN_NPM_CONFIG_PROVENANCE\` environment variable, or per-package through the \`publishConfig.provenance\` field in package.json.`,
  });

  dryRun = Option.Boolean(`--dry-run`, false, {
    description: `Show what would be published without actually publishing`,
  });

  json = Option.Boolean(`--json`, false, {
    description: `Output the result in JSON format`,
  });

  registry = Option.String(`--registry`, {
    description: `The registry to publish to`,
  });

  directory = Option.String({
    description: `The directory to publish (defaults to current directory)`,
    required: false,
  });

  async execute() {
    const cwd = this.directory ? this.directory : this.context.cwd;
    const configuration = await Configuration.find(cwd, this.context.plugins);
    const {project, workspace} = await Project.find(configuration, cwd);

    if (!workspace)
      throw new WorkspaceRequiredError(project.cwd, cwd);

    if (workspace.manifest.private)
      throw new UsageError(`Private workspaces cannot be published`);
    if (workspace.manifest.name === null || workspace.manifest.version === null)
      throw new UsageError(`Workspaces must have valid names and versions to be published on an external registry`);

    await project.restoreInstallState();

    // We store it so that TS knows that it's non-null
    const ident = workspace.manifest.name;
    const version = workspace.manifest.version;

    const registry = this.registry || npmConfigUtils.getPublishRegistry(workspace.manifest, {configuration});

    // For JSON output, we need to collect data and output it differently
    if (this.json) {
      const result = await this.executeWithJsonOutput(workspace, registry, configuration, ident, version);
      this.context.stdout.write(JSON.stringify(result, null, 2) + '\n');
      return 0;
    }

    const report = await StreamReport.start({
      configuration,
      stdout: this.context.stdout,
    }, async report => {
      // Not an error if --tolerate-republish is set
      if (this.tolerateRepublish) {
        try {
          const registryData = await npmHttpUtils.get(npmHttpUtils.getIdentUrl(ident), {
            configuration,
            registry,
            ident,
            jsonResponse: true,
          });

          if (!Object.hasOwn(registryData, `versions`))
            throw new ReportError(MessageName.REMOTE_INVALID, `Registry returned invalid data for - missing "versions" field`);

          if (Object.hasOwn(registryData.versions, version)) {
            report.reportWarning(MessageName.UNNAMED, `Registry already knows about version ${version}; skipping.`);
            return;
          }
        } catch (err) {
          if (err.originalError?.response?.statusCode !== 404) {
            throw err;
          }
        }
      }

      await scriptUtils.maybeExecuteWorkspaceLifecycleScript(workspace, `prepublish`, {report});

      await packUtils.prepareForPack(workspace, {report}, async () => {
        const files = await packUtils.genPackList(workspace);

        for (const file of files)
          report.reportInfo(null, file);

        const pack = await packUtils.genPackStream(workspace, files);
        const buffer = await miscUtils.bufferStream(pack);

        const gitHead = await npmPublishUtils.getGitHead(workspace.cwd);

        let provenance = false;
        if (workspace.manifest.publishConfig && `provenance` in workspace.manifest.publishConfig) {
          provenance = Boolean(workspace.manifest.publishConfig.provenance);
          if (provenance) {
            report.reportInfo(null, `Generating provenance statement because \`publishConfig.provenance\` field is set.`);
          } else {
            report.reportInfo(null, `Skipping provenance statement because \`publishConfig.provenance\` field is set to false.`);
          }
        } else if (this.provenance) {
          provenance = true;
          report.reportInfo(null, `Generating provenance statement because \`--provenance\` flag is set.`);
        } else if (configuration.get(`npmPublishProvenance`)) {
          provenance = true;
          report.reportInfo(null, `Generating provenance statement because \`npmPublishProvenance\` setting is set.`);
        }

        const body = await npmPublishUtils.makePublishBody(workspace, buffer, {
          access: this.access,
          tag: this.tag,
          registry,
          gitHead,
          provenance,
        });

        if (!this.dryRun) {
          await npmHttpUtils.put(npmHttpUtils.getIdentUrl(ident), body, {
            configuration,
            registry,
            ident,
            otp: this.otp,
            jsonResponse: true,
          });
        } else {
          report.reportInfo(MessageName.UNNAMED, `[DRY RUN] Package would be published to ${registry}`);
        }
      });

      if (!this.dryRun) {
        report.reportInfo(MessageName.UNNAMED, `Package archive published`);
      } else {
        report.reportInfo(MessageName.UNNAMED, `[DRY RUN] Package publication completed`);
      }
    });

    return report.exitCode();
  }

  private async executeWithJsonOutput(workspace: any, registry: string, configuration: any, ident: any, version: string) {
    const result: any = {
      name: ident.name,
      version: version,
      registry: registry,
      dryRun: this.dryRun,
    };

    try {
      // Not an error if --tolerate-republish is set
      if (this.tolerateRepublish) {
        try {
          const registryData = await npmHttpUtils.get(npmHttpUtils.getIdentUrl(ident), {
            configuration,
            registry,
            ident,
            jsonResponse: true,
          });

          if (!Object.hasOwn(registryData, `versions`))
            throw new ReportError(MessageName.REMOTE_INVALID, `Registry returned invalid data for - missing "versions" field`);

          if (Object.hasOwn(registryData.versions, version)) {
            result.warning = `Registry already knows about version ${version}; skipping.`;
            return result;
          }
        } catch (err) {
          if (err.originalError?.response?.statusCode !== 404) {
            throw err;
          }
        }
      }

      await packUtils.prepareForPack(workspace, {
        reportInfo: () => {},
        reportWarning: () => {},
        reportError: () => {},
      }, async () => {
        const files = await packUtils.genPackList(workspace);
        result.files = files;

        const pack = await packUtils.genPackStream(workspace, files);
        const buffer = await miscUtils.bufferStream(pack);

        const gitHead = await npmPublishUtils.getGitHead(workspace.cwd);

        let provenance = false;
        if (workspace.manifest.publishConfig && `provenance` in workspace.manifest.publishConfig) {
          provenance = Boolean(workspace.manifest.publishConfig.provenance);
        } else if (this.provenance) {
          provenance = true;
        } else if (configuration.get(`npmPublishProvenance`)) {
          provenance = true;
        }

        result.provenance = provenance;
        result.gitHead = gitHead;

        const body = await npmPublishUtils.makePublishBody(workspace, buffer, {
          access: this.access,
          tag: this.tag,
          registry,
          gitHead,
          provenance,
        });

        if (!this.dryRun) {
          await npmHttpUtils.put(npmHttpUtils.getIdentUrl(ident), body, {
            configuration,
            registry,
            ident,
            otp: this.otp,
            jsonResponse: true,
          });
          result.published = true;
        } else {
          result.published = false;
        }
      });

      if (!this.dryRun) {
        result.message = `Package archive published`;
      } else {
        result.message = `Package publication completed (dry run)`;
      }

      return result;
    } catch (error) {
      result.error = error.message;
      return result;
    }
  }
}
