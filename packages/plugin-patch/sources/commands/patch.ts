import {BaseCommand, WorkspaceRequiredError}                                                           from '@yarnpkg/cli';
import {Cache, Configuration, Project, formatUtils, structUtils, StreamReport, MessageName, miscUtils} from '@yarnpkg/core';
import {npath}                                                                                         from '@yarnpkg/fslib';
import {Command, Option, Usage, UsageError}                                                            from 'clipanion';

import * as patchUtils                                                                                 from '../patchUtils';

// eslint-disable-next-line arca/no-default-export
export default class PatchCommand extends BaseCommand {
  static paths = [
    [`patch`],
  ];

  static usage: Usage = Command.Usage({
    description: `prepare a package for patching`,
    details: `
      This command will cause a package to be extracted in a temporary directory intended to be editable at will.
      
      Once you're done with your changes, run \`yarn patch-commit -s <path>\` (with \`<path>\` being the temporary directory you received) to generate a patchfile and register it into your top-level manifest via the \`patch:\` protocol. Run \`yarn patch-commit -h\` for more details.
    `,
  });

  json = Option.Boolean(`--json`, false, {
    description: `Format the output as an NDJSON stream`,
  });

  package = Option.String();

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
      json: this.json,
      stdout: this.context.stdout,
    }, async report => {
      const temp = await patchUtils.extractPackageToDisk(locator, {cache, project});

      report.reportJson({
        locator: structUtils.stringifyLocator(locator),
        path: npath.fromPortablePath(temp),
      });

      report.reportInfo(MessageName.UNNAMED, `Package ${structUtils.prettyLocator(configuration, locator)} got extracted with success!`);
      report.reportInfo(MessageName.UNNAMED, `You can now edit the following folder: ${formatUtils.pretty(configuration, npath.fromPortablePath(temp), `magenta`)}`);
      report.reportInfo(MessageName.UNNAMED, `Once you are done run ${formatUtils.pretty(configuration, `yarn patch-commit -s ${process.platform === `win32` ? `"` : ``}${npath.fromPortablePath(temp)}${process.platform === `win32` ? `"` : ``}`, `cyan`)} and Yarn will store a patchfile based on your changes.`);
    });
  }
}
