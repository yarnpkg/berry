import {BaseCommand, WorkspaceRequiredError}         from '@yarnpkg/cli';
import {Cache, Configuration, Project, StreamReport} from '@yarnpkg/core';
import {structUtils}                                 from '@yarnpkg/core';
import {Command, Usage, UsageError}                  from 'clipanion';
import micromatch                                    from 'micromatch';

// eslint-disable-next-line arca/no-default-export
export default class UnplugCommand extends BaseCommand {
  @Command.Rest()
  patterns: Array<string> = [];

  static usage: Usage = Command.Usage({
    description: `force the unpacking of a list of packages`,
    details: `
      This command will add the selectors matching the specified patterns to the list of packages that must be unplugged when installed.

      A package being unplugged means that instead of being referenced directly through its archive, it will be unpacked at install time in the directory configured via \`virtualFolder\`.

      Unpacking a package isn't advised as a general tool because it makes it harder to store your packages within the repository. However, it's a good approach to quickly and safely debug some packages, and can even sometimes be required depending on the context (for example when the package contains shellscripts).

      The unplug command sets a flag that's persisted in your top-level \`package.json\` through the \`dependenciesMeta\` field. As such, to undo its effects, just revert the changes made to the manifest and run \`yarn install\`.

      This command accepts glob patterns as arguments (if valid Descriptors and supported by [micromatch](https://github.com/micromatch/micromatch)). Make sure to escape the patterns, to prevent your own shell from trying to expand them.
    `,
    examples: [[
      `Unplug lodash`,
      `yarn unplug lodash`,
    ], [
      `Unplug one specific version of lodash`,
      `yarn unplug lodash@1.2.3`,
    ], [
      `Unplug all packages with the \`@babel\` scope`,
      `yarn unplug '@babel/*'`,
    ]],
  });

  @Command.Path(`unplug`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project, workspace} = await Project.find(configuration, this.context.cwd);
    const cache = await Cache.find(configuration);

    if (!workspace)
      throw new WorkspaceRequiredError(project.cwd, this.context.cwd);

    const descriptors = [...project.storedDescriptors.values()];
    const stringifiedDescriptors = descriptors.map(descriptor => structUtils.stringifyDescriptor(descriptor));

    const {topLevelWorkspace} = project;

    const unreferencedPatterns = [];

    for (const pattern of this.patterns) {
      let isReferenced = false;

      // This isn't really needed - It's just for consistency:
      // All patterns are either valid or not for all commands (e.g. remove, up)
      const pseudoDescriptor = structUtils.parseDescriptor(pattern);

      for (const stringifiedDescriptor of micromatch(stringifiedDescriptors, structUtils.stringifyDescriptor(pseudoDescriptor))) {
        const descriptor = structUtils.parseDescriptor(stringifiedDescriptor);

        const dependencyMeta = topLevelWorkspace.manifest.ensureDependencyMeta(descriptor);

        dependencyMeta.unplugged = true;

        isReferenced = true;
      }

      if (!isReferenced) {
        unreferencedPatterns.push(pattern);
      }
    }

    if (unreferencedPatterns.length > 1)
      throw new UsageError(`Patterns ${unreferencedPatterns.join(`, `)} don't match any packages referenced by any workspace`);
    if (unreferencedPatterns.length > 0)
      throw new UsageError(`Pattern ${unreferencedPatterns[0]} doesn't match any packages referenced by any workspace`);

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
