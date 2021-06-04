import {BaseCommand, WorkspaceRequiredError}                                         from '@yarnpkg/cli';
import {Configuration, Project, structUtils, MessageName, StreamReport, formatUtils} from '@yarnpkg/core';
import {npmHttpUtils, npmConfigUtils}                                                from '@yarnpkg/plugin-npm';
import {Command, Option, Usage, UsageError}                                          from 'clipanion';

import {getDistTags}                                                                 from './list';

// eslint-disable-next-line arca/no-default-export
export default class NpmTagRemoveCommand extends BaseCommand {
  static paths = [
    [`npm`, `tag`, `remove`],
  ];

  static usage: Usage = Command.Usage({
    category: `Npm-related commands`,
    description: `remove a tag from a package`,
    details: `
      This command will remove a tag from a package from the npm registry.
    `,
    examples: [[
      `Remove the \`beta\` tag from package \`my-pkg\``,
      `yarn npm tag remove my-pkg beta`,
    ]],
  });

  package = Option.String();
  tag = Option.String();

  async execute() {
    if (this.tag === `latest`)
      throw new UsageError(`The 'latest' tag cannot be removed.`);

    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project, workspace} = await Project.find(configuration, this.context.cwd);

    if (!workspace)
      throw new WorkspaceRequiredError(project.cwd, this.context.cwd);

    const ident = structUtils.parseIdent(this.package);

    const registry = npmConfigUtils.getPublishRegistry(workspace.manifest, {configuration});

    const prettyTag = formatUtils.pretty(configuration, this.tag, formatUtils.Type.CODE);
    const prettyIdent = formatUtils.pretty(configuration, ident, formatUtils.Type.IDENT);

    const distTags = await getDistTags(ident, configuration);
    if (!Object.prototype.hasOwnProperty.call(distTags, this.tag))
      throw new UsageError(`${prettyTag} is not a tag of package ${prettyIdent}`);

    const report = await StreamReport.start({
      configuration,
      stdout: this.context.stdout,
    }, async report => {
      const url = `/-/package${npmHttpUtils.getIdentUrl(ident)}/dist-tags/${encodeURIComponent(this.tag)}`;

      await npmHttpUtils.del(url, {
        configuration,
        registry,
        ident,
        jsonResponse: true,
      });

      report.reportInfo(MessageName.UNNAMED, `Tag ${prettyTag} removed from package ${prettyIdent}`);
    });

    return report.exitCode();
  }
}
