import {BaseCommand, WorkspaceRequiredError}                                                    from '@yarnpkg/cli';
import {Configuration, MessageName, Project, ReportError, StreamReport, scriptUtils, miscUtils} from '@yarnpkg/core';
import {npmConfigUtils, npmHttpUtils, npmPublishUtils}                                          from '@yarnpkg/plugin-npm';
import {packUtils}                                                                              from '@yarnpkg/plugin-pack';
import {Command, Usage, UsageError}                                                             from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default class NpmPublishCommand extends BaseCommand {
  @Command.String(`--access`, {description: `The access for the published package (public or restricted)`})
  access?: string;

  @Command.String(`--tag`, {description: `The tag on the registry that the package should be attached to`})
  tag: string = `latest`;

  @Command.Boolean(`--tolerate-republish`, {description: `Warn and exit when republishing an already existing version of a package`})
  tolerateRepublish: boolean = false;

  static usage: Usage = Command.Usage({
    category: `Npm-related commands`,
    description: `publish the active workspace to the npm registry`,
    details: `
      This command will pack the active workspace into a fresh archive and upload it to the npm registry.

      The package will by default be attached to the \`latest\` tag on the registry, but this behavior can be overriden by using the \`--tag\` option.

      Note that for legacy reasons scoped packages are by default published with an access set to \`restricted\` (aka "private packages"). This requires you to register for a paid npm plan. In case you simply wish to publish a public scoped package to the registry (for free), just add the \`--access public\` flag. This behavior can be enabled by default through the \`npmPublishAccess\` settings.
    `,
    examples: [[
      `Publish the active workspace`,
      `yarn npm publish`,
    ]],
  });

  @Command.Path(`npm`, `publish`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project, workspace} = await Project.find(configuration, this.context.cwd);

    if (!workspace)
      throw new WorkspaceRequiredError(project.cwd, this.context.cwd);

    if (workspace.manifest.private)
      throw new UsageError(`Private workspaces cannot be published`);
    if (workspace.manifest.name === null || workspace.manifest.version === null)
      throw new UsageError(`Workspaces must have valid names and versions to be published on an external registry`);

    await project.restoreInstallState();

    // We store it so that TS knows that it's non-null
    const ident = workspace.manifest.name;
    const version = workspace.manifest.version;

    const registry = npmConfigUtils.getPublishRegistry(workspace.manifest, {configuration});

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

          if (!Object.prototype.hasOwnProperty.call(registryData, `versions`))
            throw new ReportError(MessageName.REMOTE_INVALID, `Registry returned invalid data for - missing "versions" field`);

          if (Object.prototype.hasOwnProperty.call(registryData.versions, version)) {
            report.reportWarning(MessageName.UNNAMED, `Registry already knows about version ${version}; skipping.`);
            return;
          }
        } catch (error) {
          if (error.name !== `HTTPError`) {
            throw error;
          } else if (error.response.statusCode !== 404) {
            throw new ReportError(MessageName.NETWORK_ERROR, `The remote server answered with HTTP ${error.response.statusCode} ${error.response.statusMessage}`);
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

        const body = await npmPublishUtils.makePublishBody(workspace, buffer, {
          access: this.access,
          tag: this.tag,
          registry,
        });

        try {
          await npmHttpUtils.put(npmHttpUtils.getIdentUrl(ident), body, {
            configuration,
            registry,
            ident,
            jsonResponse: true,
          });
        } catch (error) {
          if (error.name !== `HTTPError`) {
            throw error;
          } else {
            const message = error.response.body && error.response.body.error
              ? error.response.body.error
              : `The remote server answered with HTTP ${error.response.statusCode} ${error.response.statusMessage}`;

            report.reportError(MessageName.NETWORK_ERROR, message);
          }
        }
      });

      if (!report.hasErrors()) {
        report.reportInfo(MessageName.UNNAMED, `Package archive published`);
      }
    });

    return report.exitCode();
  }
}
