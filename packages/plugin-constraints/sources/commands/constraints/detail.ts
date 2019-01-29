import {Configuration, Project, Plugin} from '@berry/core';
import {structUtils}                    from '@berry/core';
import emoji                            from 'node-emoji';
import {Writable}                       from 'stream';

import {Constraints}                    from '../../Constraints';

export default (concierge: any, plugins: Map<string, Plugin>) => concierge

  .command(`constraints detail`)

  .categorize(`Constraints-related commands`)
  .describe(`print the project constraints`)

  .action(async ({cwd, stdout}: {cwd: string, stdout: Writable}) => {
    const configuration = await Configuration.find(cwd, plugins);
    const {project} = await Project.find(configuration, cwd);
    const constraints = await Constraints.find(project);

    const report = await constraints.process();

    for (const {workspace, dependencyIdent, dependencyRange} of report.enforcedDependencyRanges) {
      if (dependencyRange !== null) {
        stdout.write(`${emoji.get(`link`)} ${structUtils.prettyLocator(configuration, workspace.locator)} is fixed to ${structUtils.prettyDescriptor(configuration, structUtils.makeDescriptor(dependencyIdent, dependencyRange))}.\n`);
      } else {
        stdout.write(`${emoji.get(`no_entry`)} ${structUtils.prettyLocator(configuration, workspace.locator)} is forbidden from depending on ${structUtils.prettyIdent(configuration, dependencyIdent)}.\n`);
      }
    }

    for (const {workspace, dependencyIdent, reason} of report.invalidDependencies) {
      stdout.write(`${emoji.get(`x`)} ${structUtils.prettyLocator(configuration, workspace.locator)}'s dependency on ${structUtils.prettyIdent(configuration, dependencyIdent)} is invalid${reason ? ` (reason: ${reason})` : ``}.\n`);
    }
  });
