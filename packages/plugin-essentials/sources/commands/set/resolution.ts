import {BaseCommand, WorkspaceRequiredError}         from '@yarnpkg/cli';
import {Configuration, Cache, Project, StreamReport} from '@yarnpkg/core';
import {structUtils}                                 from '@yarnpkg/core';
import {Command, Option, Usage}                      from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default class SetResolutionCommand extends BaseCommand {
  static paths = [
    [`set`, `resolution`],
  ];

  static usage: Usage = Command.Usage({
    description: `enforce a package resolution`,
    details: `
      This command updates the resolution table so that \`descriptor\` is resolved by \`resolution\`.

      Note that by default this command only affect the current resolution table - meaning that this "manual override" will disappear if you remove the lockfile, or if the package disappear from the table. If you wish to make the enforced resolution persist whatever happens, add the \`-s,--save\` flag which will also edit the \`resolutions\` field from your top-level manifest.

      Note that no attempt is made at validating that \`resolution\` is a valid resolution entry for \`descriptor\`.
    `,
    examples: [[
      `Force all instances of lodash@npm:^1.2.3 to resolve to 1.5.0`,
      `$0 set resolution lodash@npm:^1.2.3 1.5.0`,
    ]],
  });

  save = Option.Boolean(`-s,--save`, false, {
    description: `Persist the resolution inside the top-level manifest`,
  });

  descriptor = Option.String();
  resolution = Option.String();

  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project, workspace} = await Project.find(configuration, this.context.cwd);
    const cache = await Cache.find(configuration);

    if (!workspace)
      throw new WorkspaceRequiredError(project.cwd, this.context.cwd);

    const fromDescriptor = structUtils.parseDescriptor(this.descriptor, true);
    const toDescriptor = structUtils.makeDescriptor(fromDescriptor, this.resolution);

    project.storedDescriptors.set(fromDescriptor.descriptorHash, fromDescriptor);
    project.storedDescriptors.set(toDescriptor.descriptorHash, toDescriptor);

    project.resolutionAliases.set(fromDescriptor.descriptorHash, toDescriptor.descriptorHash);

    const report = await StreamReport.start({
      configuration,
      stdout: this.context.stdout,
    }, async (report: StreamReport) => {
      await project.install({cache, report});
    });

    return report.exitCode();
  }
}
