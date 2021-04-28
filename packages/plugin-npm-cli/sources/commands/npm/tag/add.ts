import {BaseCommand, WorkspaceRequiredError}                                         from '@yarnpkg/cli';
import {Configuration, Project, structUtils, MessageName, StreamReport, formatUtils} from '@yarnpkg/core';
import {npmHttpUtils, npmConfigUtils}                                                from '@yarnpkg/plugin-npm';
import {Command, UsageError, Usage, Option}                                          from 'clipanion';
import semver                                                                        from 'semver';

import {getDistTags}                                                                 from './list';

// eslint-disable-next-line arca/no-default-export
export default class NpmTagAddCommand extends BaseCommand {
  static paths = [
    [`npm`, `tag`, `add`],
  ];

  static usage: Usage = Command.Usage({
    category: `Npm-related commands`,
    description: `add a tag for a specific version of a package`,
    details: `
      This command will add a tag to the npm registry for a specific version of a package. If the tag already exists, it will be overwritten.
    `,
    examples: [[
      `Add a \`beta\` tag for version \`2.3.4-beta.4\` of package \`my-pkg\``,
      `yarn npm tag add my-pkg@2.3.4-beta.4 beta`,
    ]],
  });

  package = Option.String();
  tag = Option.String();

  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project, workspace} = await Project.find(configuration, this.context.cwd);

    if (!workspace)
      throw new WorkspaceRequiredError(project.cwd, this.context.cwd);

    const descriptor = structUtils.parseDescriptor(this.package, true);
    const version = descriptor.range;
    if (!semver.valid(version))
      throw new UsageError(`The range ${formatUtils.pretty(configuration, descriptor.range, formatUtils.Type.RANGE)} must be a valid semver version`);

    const registry = npmConfigUtils.getPublishRegistry(workspace.manifest, {configuration});

    const prettyIdent = formatUtils.pretty(configuration, descriptor, formatUtils.Type.IDENT);
    const prettyVersion = formatUtils.pretty(configuration, version, formatUtils.Type.RANGE);
    const prettyTag = formatUtils.pretty(configuration, this.tag, formatUtils.Type.CODE);

    const report = await StreamReport.start({
      configuration,
      stdout: this.context.stdout,
    }, async report => {
      const distTags = await getDistTags(descriptor, configuration);
      if (Object.prototype.hasOwnProperty.call(distTags, this.tag) && distTags[this.tag] === version)
        report.reportWarning(MessageName.UNNAMED, `Tag ${prettyTag} is already set to version ${prettyVersion}`);

      const url = `/-/package${npmHttpUtils.getIdentUrl(descriptor)}/dist-tags/${encodeURIComponent(this.tag)}`;

      await npmHttpUtils.put(url, version, {
        configuration,
        registry,
        ident: descriptor,
        jsonRequest: true,
        jsonResponse: true,
      });

      report.reportInfo(MessageName.UNNAMED, `Tag ${prettyTag} added to version ${prettyVersion} of package ${prettyIdent}`);
    });

    return report.exitCode();
  }
}
