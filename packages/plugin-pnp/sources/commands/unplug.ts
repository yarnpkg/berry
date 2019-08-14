import {WorkspaceRequiredError}                                      from '@berry/cli';
import {Cache, CommandContext, Configuration, Project, StreamReport} from '@berry/core';
import {structUtils}                                                 from '@berry/core';
import {Command}                                                     from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default class UnplugCommand extends Command<CommandContext> {
  @Command.Rest()
  patterns: Array<string> = [];

  static usage = Command.Usage({
    description: `force the unpacking of a list of packages`,
    details: `
      This command will add the specified selectors to the list of packages that must be unplugged when installed.

      A package being unplugged means that instead of being referenced directly through its archive, it will be unpacked at install time in the directory configured via \`virtualFolder\`.

      Unpacking a package isn't advised as a general tool because it makes it harder to store your packages within the repository. However, it's a good approach to quickly and safely debug some packages, and can even sometimes be required depending on the context (for example when the package contains shellscripts).

      The unplug command sets a flag that's persisted in your top-level \`package.json\` through the \`dependenciesMeta\` field. As such, to undo its effects, just revert the changes made to the manifest and run \`yarn install\`.
    `,
    examples: [[
      `Unplug lodash`,
      `yarn unplug lodash`,
    ], [
      `Unplug one specific version of lodash`,
      `yarn unplug lodash@1.2.3`,
    ]],
  });

  @Command.Path(`unplug`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project, workspace} = await Project.find(configuration, this.context.cwd);
    const cache = await Cache.find(configuration);

    if (!workspace)
      throw new WorkspaceRequiredError(this.context.cwd);

    const topLevelWorkspace = project.topLevelWorkspace;

    for (const pattern of this.patterns) {
      const descriptor = structUtils.parseDescriptor(pattern);
      const dependencyMeta = topLevelWorkspace.manifest.ensureDependencyMeta(descriptor);

      dependencyMeta.unplugged = true;0
    }

    await topLevelWorkspace.persistManifest();

    const report = await StreamReport.start({
      configuration,
      stdout: this.context.stdout,
    }, async report => {
      await project.install({cache, report});
    });

    return report.exitCode();
  }
}
