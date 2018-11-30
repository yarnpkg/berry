import emoji = require('node-emoji');

import {Configuration, Descriptor, Project, Plugin} from '@berry/core';
import {structUtils}                                from '@berry/core';
import {Writable}                                   from 'stream';

import {Constraints}                                from '../../Constraints';

export default (concierge: any, plugins: Map<string, Plugin>) => concierge

  .command(`constraints check`)

  .categorize(`Constraints-related commands`)
  .describe(`check that the project constraints are met`)

  .action(async ({cwd, stdout}: {cwd: string, stdout: Writable}) => {
    const configuration = await Configuration.find(cwd, plugins);
    const {project} = await Project.find(configuration, cwd);
    const constraints = await Constraints.find(project);

    const report = await constraints.process();
    let hasErrors = false;

    for (const {packageLocator, dependencyIdent, dependencyRange} of report.enforcedDependencyRanges) {
      const workspace = project.getWorkspaceByLocator(packageLocator);

      if (dependencyRange !== null) {
        const invalidDependencies = Array.from(workspace.manifest.dependencies.values()).filter((dependency: Descriptor) => {
          return structUtils.areIdentsEqual(dependency, dependencyIdent) && dependency.range !== dependencyRange;
        });

        for (const invalid of invalidDependencies)
          stdout.write(`${emoji.get(`link`)} ${structUtils.prettyLocator(configuration, packageLocator)} is fixed to ${structUtils.prettyDescriptor(configuration, structUtils.makeDescriptor(dependencyIdent, dependencyRange))}.\n`);

        hasErrors = hasErrors || invalidDependencies.length > 0;
      } else {
        const invalidDependencies = Array.from(workspace.manifest.dependencies.values()).filter((dependency: Descriptor) => {
          return structUtils.areIdentsEqual(dependency, dependencyIdent);
        });

        for (const invalid of invalidDependencies)
          stdout.write(`${emoji.get(`no_entry`)} ${structUtils.prettyLocator(configuration, packageLocator)} is forbidden from depending on ${structUtils.prettyIdent(configuration, dependencyIdent)}.\n`);

        hasErrors = hasErrors || invalidDependencies.length > 0;
      }
    }


    for (const {packageLocator, dependencyDescriptor, reason} of report.invalidDependencies) {
      const workspace = project.getWorkspaceByLocator(packageLocator);

      const invalidDependencies = Array.from(workspace.manifest.dependencies.values()).filter((dependency: Descriptor) => {
        return structUtils.areDescriptorsEqual(dependency, dependencyDescriptor);
      });

      for (const invalid of invalidDependencies)
        stdout.write(`${emoji.get(`x`)} ${structUtils.prettyLocator(configuration, packageLocator)}'s dependency on ${structUtils.prettyDescriptor(configuration, invalid)} is invalid${reason ? ` (reason: ${reason})` : ``}.\n`);

      hasErrors = hasErrors || invalidDependencies.length > 0;
    }

    return hasErrors ? 1 : 0;
  });
