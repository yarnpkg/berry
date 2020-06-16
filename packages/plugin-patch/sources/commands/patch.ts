import {BaseCommand, WorkspaceRequiredError}                                              from '@yarnpkg/cli';
import {Cache, Configuration, Project, structUtils, StreamReport, MessageName, miscUtils} from '@yarnpkg/core';
import {npath}                                                                            from '@yarnpkg/fslib';
import {Command, Usage, UsageError}                                                       from 'clipanion';

import * as patchUtils                                                                    from '../patchUtils';

// eslint-disable-next-line arca/no-default-export
export default class PatchCommand extends BaseCommand {
  @Command.String()
  package!: string;

  static usage: Usage = Command.Usage({
    description: `
      This command will cause a package to be extracted in a temporary directory (under a folder named "patch-workdir"). This folder will be editable at will; running \`yarn patch\` inside it will then cause Yarn to generate a patchfile and register it into your top-level manifest (cf the \`patch:\` protocol).
    `,
  });

  @Command.Path(`patch`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project, workspace} = await Project.find(configuration, this.context.cwd);
    const cache = await Cache.find(configuration);

    if (!workspace)
      throw new WorkspaceRequiredError(project.cwd, this.context.cwd);

    await project.restoreInstallState();

    let locator = structUtils.parseLocator(this.package);

    if (locator.reference === `unknown`) {
      const candidateLocators = miscUtils.mapAndFilter([...project.storedPackages.values()], pkg => {
        if (pkg.identHash !== locator.identHash)
          return miscUtils.mapAndFilter.skip;

        if (structUtils.isVirtualLocator(pkg))
          return miscUtils.mapAndFilter.skip;

        return pkg;
      });

      if (candidateLocators.length === 0)
        throw new UsageError(`No package found in the project for the given locator`);
      if (candidateLocators.length > 1)
        throw new UsageError(`Multiple candidate packages found; explicitly choose one of them (use \`yarn why <package>\` to get more information as to who depends on them):\n${candidateLocators.map(locator => `\n- ${structUtils.prettyLocator(configuration, locator)}`).join(``)}`);

      locator = candidateLocators[0];
    }

    if (!project.storedPackages.has(locator.locatorHash))
      throw new UsageError(`No package found in the project for the given locator`);

    await StreamReport.start({
      configuration,
      stdout: this.context.stdout,
    }, async report => {
      const temp = await patchUtils.extractPackageToDisk(locator, {cache, project});

      report.reportInfo(MessageName.UNNAMED, `Package ${structUtils.prettyLocator(configuration, locator)} got extracted with success!`);
      report.reportInfo(MessageName.UNNAMED, `You can now edit the following folder: ${configuration.format(npath.fromPortablePath(temp), `magenta`)}`);
      report.reportInfo(MessageName.UNNAMED, `Once you are done run ${configuration.format(`yarn patch-commit ${npath.fromPortablePath(temp)}`, `cyan`)} and Yarn will store a patchfile based on your changes.`);
    });
  }
}
