import emoji = require('node-emoji');

import {Configuration, Project, Plugin} from '@berry/core';
import {structUtils}                    from '@berry/core';
import {Writable}                       from 'stream';

import {Constraints}                    from '../../Constraints';

export default (concierge: any, plugins: Map<string, Plugin>) => concierge

  .command(`constraints detail`)

  .categorize(`Constraint commands`)
  .describe(`print the project constraints`)

  .action(async ({cwd, stdout}: {cwd: string, stdout: Writable}) => {
    const configuration = await Configuration.find(cwd, plugins);
    const {project} = await Project.find(configuration, cwd);
    const constraints = await Constraints.find(project);

    const report = await constraints.process();

    for (const {packageLocator, dependencyIdent, dependencyRange} of report.enforcedDependencyRanges) {
      if (dependencyRange !== null) {
        stdout.write(`${emoji.get(`link`)} ${structUtils.prettyLocator(configuration, packageLocator)} is fixed to ${structUtils.prettyDescriptor(configuration, structUtils.makeDescriptor(dependencyIdent, dependencyRange))}.\n`);
      } else {
        stdout.write(`${emoji.get(`no_entry`)} ${structUtils.prettyLocator(configuration, packageLocator)} is forbidden from depending on ${structUtils.prettyIdent(configuration, dependencyIdent)}.\n`);
      }
    }

    for (const {packageLocator, dependencyDescriptor, reason} of report.invalidDependencies) {
      stdout.write(`${emoji.get(`x`)} ${structUtils.prettyLocator(configuration, packageLocator)}'s dependency on ${structUtils.prettyDescriptor(configuration, dependencyDescriptor)} is invalid${reason ? ` (reason: ${reason})` : ``}.\n`);
    }
  });
