import {BaseCommand, WorkspaceRequiredError}                                                                              from '@yarnpkg/cli';
import {Cache, Configuration, Project, StreamReport, Package, MessageName, FormatType, LocatorHash, Workspace, miscUtils} from '@yarnpkg/core';
import {structUtils, semverUtils}                                                                                         from '@yarnpkg/core';
import {Command, Usage, UsageError}                                                                                       from 'clipanion';
import micromatch                                                                                                         from 'micromatch';
import semver                                                                                                             from 'semver';

import * as pnpUtils                                                                                                      from '../pnpUtils';

// eslint-disable-next-line arca/no-default-export
export default class UnplugCommand extends BaseCommand {
  @Command.Rest()
  patterns: Array<string> = [];

  @Command.Boolean(`-A,--all`)
  all: boolean = false;

  @Command.Boolean(`-R,--recursive`)
  recursive: boolean = false;

  @Command.Boolean(`--json`)
  json: boolean = false;

  static usage: Usage = Command.Usage({
    description: `force the unpacking of a list of packages`,
    details: `
      This command will add the selectors matching the specified patterns to the list of packages that must be unplugged when installed.

      A package being unplugged means that instead of being referenced directly through its archive, it will be unpacked at install time in the directory configured via \`pnpUnpluggedFolder\`. Note that unpacking packages this way is generally not recommended because it'll make it harder to store your packages within the repository. However, it's a good approach to quickly and safely debug some packages, and can even sometimes be required depending on the context (for example when the package contains shellscripts).

      Running the command will set a persistent flag inside your top-level \`package.json\`, in the \`dependenciesMeta\` field. As such, to undo its effects, you'll need to revert the changes made to the manifest and run \`yarn install\` to apply the modification.

      By default, only direct dependencies from the current workspace are affected. If \`-A,--all\` is set, direct dependencies from the entire project are affected. Using the \`-R,--recursive\` flag will affect transitive dependencies as well as direct ones.

      This command accepts glob patterns inside the scope and name components (not the range). Make sure to escape the patterns to prevent your own shell from trying to expand them.
    `,
    examples: [[
      `Unplug the lodash dependency from the active workspace`,
      `yarn unplug lodash`,
    ], [
      `Unplug all instances of lodash referenced by any workspace`,
      `yarn unplug lodash -A`,
    ], [
      `Unplug all instances of lodash referenced by the active workspace and its dependencies`,
      `yarn unplug lodash -R`,
    ], [
      `Unplug all instances of lodash, anywhere`,
      `yarn unplug lodash -AR`,
    ], [
      `Unplug one specific version of lodash`,
      `yarn unplug lodash@1.2.3`,
    ], [
      `Unplug all packages with the \`@babel\` scope`,
      `yarn unplug '@babel/*'`,
    ], [
      `Unplug all packages (only for testing, not recommended)`,
      `yarn unplug -R '*'`,
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

    const unreferencedPatterns = new Set(this.patterns);

    const matchers = this.patterns.map(pattern => {
      const patternDescriptor = structUtils.parseDescriptor(pattern);
      const pseudoDescriptor = patternDescriptor.range !== `unknown`
        ? patternDescriptor
        : structUtils.makeDescriptor(patternDescriptor, `*`);

      if (!semver.validRange(pseudoDescriptor.range))
        throw new UsageError(`The range of the descriptor patterns must be a valid semver range (${structUtils.prettyDescriptor(configuration, pseudoDescriptor)})`);

      return (pkg: Package) => {
        const stringifiedIdent = structUtils.stringifyIdent(pkg);
        if (!micromatch.isMatch(stringifiedIdent, structUtils.stringifyIdent(pseudoDescriptor)))
          return false;

        if (pkg.version && !semverUtils.satisfiesWithPrereleases(pkg.version, pseudoDescriptor.range))
          return false;

        unreferencedPatterns.delete(pattern);

        return true;
      };
    });

    const getAllMatchingPackages = () => {
      const selection: Array<Package> = [];

      for (const pkg of project.storedPackages.values())
        if (!project.tryWorkspaceByLocator(pkg) && !structUtils.isVirtualLocator(pkg) && matchers.some(matcher => matcher(pkg)))
          selection.push(pkg);

      return selection;
    };

    const getSelectedPackages = (roots: Array<Workspace>) => {
      const seen: Set<LocatorHash> = new Set();
      const selection: Array<Package> = [];

      const traverse = (pkg: Package, depth: number) => {
        if (seen.has(pkg.locatorHash))
          return;

        seen.add(pkg.locatorHash);

        if (!project.tryWorkspaceByLocator(pkg) && !structUtils.isVirtualLocator(pkg) && matchers.some(matcher => matcher(pkg)))
          selection.push(pkg);

        // Don't recurse unless requested
        if (depth > 0 && !this.recursive)
          return;

        for (const dependency of pkg.dependencies.values()) {
          const resolution = project.storedResolutions.get(dependency.descriptorHash);
          if (!resolution)
            throw new Error(`Assertion failed: The resolution should have been registered`);

          const nextPkg = project.storedPackages.get(resolution);
          if (!nextPkg)
            throw new Error(`Assertion failed: The package should have been registered`);

          traverse(nextPkg, depth + 1);
        }
      };

      for (const workspace of roots) {
        const pkg = project.storedPackages.get(workspace.anchoredLocator.locatorHash);
        if (!pkg)
          throw new Error(`Assertion failed: The package should have been registered`);

        traverse(pkg, 0);
      }

      return selection;
    };

    let selection: Array<Package>;

    // We can shortcut the execution if we want all the dependencies and
    // transitive dependencies of all the branches: it means we want everything!
    if (this.all && this.recursive)
      selection = getAllMatchingPackages();
    else if (this.all)
      selection = getSelectedPackages(project.workspaces);
    else
      selection = getSelectedPackages([workspace]);

    const projectOrWorkspaces = this.recursive
      ? `the project`
      : `any workspace`;

    if (unreferencedPatterns.size > 1)
      throw new UsageError(`Patterns ${[...unreferencedPatterns].join(`, `)} don't match any packages referenced by ${projectOrWorkspaces}`);
    if (unreferencedPatterns.size > 0)
      throw new UsageError(`Pattern ${[...unreferencedPatterns][0]} doesn't match any packages referenced by ${projectOrWorkspaces}`);

    selection = miscUtils.sortMap(selection, pkg => {
      return structUtils.stringifyLocator(pkg);
    });

    const report = await StreamReport.start({
      configuration,
      stdout: this.context.stdout,
      json: this.json,
    }, async report => {
      for (const pkg of selection) {
        const version = pkg.version ?? `unknown`;

        const dependencyMeta = project.topLevelWorkspace.manifest.ensureDependencyMeta(structUtils.makeDescriptor(pkg, version));
        dependencyMeta.unplugged = true;

        report.reportInfo(MessageName.UNNAMED, `Will unpack ${structUtils.prettyLocator(configuration, pkg)} to ${configuration.format(pnpUtils.getUnpluggedPath(pkg, {configuration}), FormatType.PATH)}`);
        report.reportJson({
          locator: structUtils.stringifyLocator(pkg),
          version,
        });
      }

      await project.topLevelWorkspace.persistManifest();

      report.reportSeparator();

      await project.install({cache, report});
    });

    return report.exitCode();
  }
}
