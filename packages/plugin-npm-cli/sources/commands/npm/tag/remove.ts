import {BaseCommand, WorkspaceRequiredError}                                         from '@yarnpkg/cli';
import {Configuration, Project, structUtils, MessageName, StreamReport, formatUtils} from '@yarnpkg/core';
import {npmHttpUtils, npmConfigUtils}                                                from '@yarnpkg/plugin-npm';
import {Command, Usage, UsageError}                                                  from 'clipanion';
import * as yup                                                                      from 'yup';

import {getDistTags}                                                                 from './list';

// eslint-disable-next-line arca/no-default-export
export default class NpmTagRemoveCommand extends BaseCommand {
  @Command.String()
  package!: string;

  @Command.String()
  tag!: string;

  static schema = yup.object().shape({
    // Better show a more detailed error, rather than the npm registry's "Bad request"
    tag: yup.string().notOneOf([`latest`]),
  });

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

  @Command.Path(`npm`, `tag`, `remove`)
  async execute() {
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
      try {
        const url = `/-/package${npmHttpUtils.getIdentUrl(ident)}/dist-tags/${encodeURIComponent(this.tag)}`;

        await npmHttpUtils.del(url, {
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

      if (!report.hasErrors()) {
        report.reportInfo(MessageName.UNNAMED, `Tag ${prettyTag} removed from package ${prettyIdent}`);
      }
    });

    return report.exitCode();
  }
}
