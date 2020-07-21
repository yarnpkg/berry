import {BaseCommand, WorkspaceRequiredError}                               from '@yarnpkg/cli';
import {Cache, Configuration, Project, StreamReport, Package, MessageName} from '@yarnpkg/core';
import {structUtils, semverUtils}                                          from '@yarnpkg/core';
import {Command, Usage, UsageError}                                        from 'clipanion';
import micromatch                                                          from 'micromatch';
import semver                                                              from 'semver';

// eslint-disable-next-line arca/no-default-export
export default class UnplugCommand extends BaseCommand {
  @Command.Rest()
  patterns: Array<string> = [];

  @Command.Boolean(`-A,--all`)
  all: boolean = false;

  @Command.Boolean(`--json`)
  json: boolean = false;

  static usage: Usage = Command.Usage({
    description: `force the unpacking of a list of packages`,
    details: `
      This command will add the selectors matching the specified patterns to the list of packages that must be unplugged when installed.

      A package being unplugged means that instead of being referenced directly through its archive, it will be unpacked at install time in the directory configured via \`pnpUnpluggedFolder\`.

      Unpacking a package isn't advised as a general tool because it makes it harder to store your packages within the repository. However, it's a good approach to quickly and safely debug some packages, and can even sometimes be required depending on the context (for example when the package contains shellscripts).

      The unplug command sets a flag that's persisted in your top-level \`package.json\` through the \`dependenciesMeta\` field. As such, to undo its effects, just revert the changes made to the manifest and run \`yarn install\`.

      By default, only packages referenced by workspaces are affected.

      If \`-A,--all\` is set, packages from the entire project are affected.

      This command accepts glob patterns as arguments (if valid Descriptors and supported by [micromatch](https://github.com/micromatch/micromatch)). Make sure to escape the patterns, to prevent your own shell from trying to expand them.

      **Note:** The ranges have to be static, only the package scopes and names can contain glob patterns.
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
    ], [
      `Unplug all instances of lodash referenced by the project`,
      `yarn unplug lodash -A`,
    ], [
      `Unplug all packages (only for testing, not recommended)`,
      `yarn unplug -A '*'`,
    ]],
  });

  @Command.Path(`unplug`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project, workspace} = await Project.find(configuration, this.context.cwd);
    const cache = await Cache.find(configuration);

    if (!workspace)
      throw new WorkspaceRequiredError(project.cwd, this.context.cwd);

    if (configuration.get(`nodeLinker`) !== `pnp`)
      throw new UsageError(`This command can only be used if the \`nodeLinker\` option is set to \`pnp\``);

    await project.restoreInstallState();

    const {topLevelWorkspace} = project;

    let packages: Set<Package>;
    if (this.all) {
      packages = new Set(project.storedPackages.values());
    } else {
      packages = new Set();
      for (const workspace of project.workspaces) {
        for (const descriptor of workspace.dependencies.values()) {
          const resolution = project.storedResolutions.get(descriptor.descriptorHash);

          if (typeof resolution === `undefined`)
            throw new Error(`Assertion failed: Expected the resolution to have been registered`);

          const pkg = project.storedPackages.get(resolution);

          if (typeof pkg === `undefined`)
            throw new Error(`Assertion failed: Expected the package to have been registered`);

          packages.add(pkg);
        }
      }
    }

    const report = await StreamReport.start({
      configuration,
      stdout: this.context.stdout,
      json: this.json,
    }, async report => {
      const unreferencedPatterns = [];

      for (const pattern of this.patterns) {
        let isReferenced = false;

        const patternDescriptor = structUtils.parseDescriptor(pattern);
        const pseudoDescriptor = patternDescriptor.range !== `unknown`
          ? patternDescriptor
          : structUtils.makeDescriptor(patternDescriptor, `*`);

        if (!semver.validRange(pseudoDescriptor.range))
          throw new UsageError(`The range of the descriptor patterns must be a valid semver range (${structUtils.prettyDescriptor(configuration, pseudoDescriptor)})`);

        for (const pkg of packages) {
          if (structUtils.isVirtualLocator(pkg))
            continue;

          const stringifiedIdent = structUtils.stringifyIdent(pkg);
          if (!micromatch.isMatch(stringifiedIdent, structUtils.stringifyIdent(pseudoDescriptor)))
            continue;

          if (pkg.version && !semverUtils.satisfiesWithPrereleases(pkg.version, pseudoDescriptor.range))
            continue;

          const version = pkg.version ?? `unknown`;

          const dependencyMeta = topLevelWorkspace.manifest.ensureDependencyMeta(
            structUtils.makeDescriptor(pkg, version)
          );
          dependencyMeta.unplugged = true;

          report.reportInfo(MessageName.UNNAMED, `Unplugged ${structUtils.prettyLocator(configuration, pkg)}`);

          report.reportJson({
            pattern,
            locator: structUtils.stringifyLocator(pkg),
            version,
          });

          isReferenced = true;
        }

        if (!isReferenced) {
          unreferencedPatterns.push(pattern);
        }
      }

      const projectOrWorkspaces = this.all
        ? `the project`
        : `any workspace`;

      if (unreferencedPatterns.length > 1)
        throw new UsageError(`Patterns ${unreferencedPatterns.join(`, `)} don't match any packages referenced by ${projectOrWorkspaces}`);
      if (unreferencedPatterns.length > 0)
        throw new UsageError(`Pattern ${unreferencedPatterns[0]} doesn't match any packages referenced by ${projectOrWorkspaces}`);

      await topLevelWorkspace.persistManifest();

      report.reportSeparator();

      await project.install({cache, report});
    });

    return report.exitCode();
  }
}
