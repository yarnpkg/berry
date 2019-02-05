import {Configuration, Descriptor, Project, Plugin} from '@berry/core';
import {MessageName, StreamReport}                  from '@berry/core';
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

    const report = await StreamReport.start({configuration, stdout}, async report => {
      const result = await constraints.process();
    
      for (const {workspace, dependencyIdent, dependencyRange} of result.enforcedDependencyRanges) {
        const dependencyDescriptor = workspace.manifest.dependencies.get(dependencyIdent.identHash);
        const devDependencyDescriptor = workspace.manifest.devDependencies.get(dependencyIdent.identHash);

        if (dependencyRange !== null) {
          const constraintDescriptor = structUtils.makeDescriptor(dependencyIdent, dependencyRange);

          if (!dependencyDescriptor && !devDependencyDescriptor) {
            report.reportError(MessageName.CONSTRAINTS_MISSING_DEPENDENCY, `${structUtils.prettyWorkspace(configuration, workspace)} must depend on ${structUtils.prettyIdent(configuration, dependencyIdent)} (via ${structUtils.prettyRange(configuration, dependencyRange)}), but doesn't`);
          } else {
            if (dependencyDescriptor && dependencyDescriptor.range !== dependencyRange)
              report.reportError(MessageName.CONSTRAINTS_INCOMPATIBLE_DEPENDENCY, `${structUtils.prettyWorkspace(configuration, workspace)} must depend on ${structUtils.prettyIdent(configuration, dependencyIdent)} via ${structUtils.prettyRange(configuration, dependencyRange)}, but uses ${structUtils.prettyRange(configuration, dependencyDescriptor.range)} instead`);

            if (devDependencyDescriptor && devDependencyDescriptor.range !== dependencyRange) {
              report.reportError(MessageName.CONSTRAINTS_INCOMPATIBLE_DEPENDENCY, `${structUtils.prettyWorkspace(configuration, workspace)} must depend on ${structUtils.prettyIdent(configuration, dependencyIdent)} via ${structUtils.prettyRange(configuration, dependencyRange)}, but uses ${structUtils.prettyRange(configuration, devDependencyDescriptor.range)} instead`);
            }
          }
        } else {
          if (dependencyDescriptor || devDependencyDescriptor) {
            report.reportError(MessageName.CONSTRAINTS_EXTRANEOUS_DEPENDENCY, `${structUtils.prettyWorkspace(configuration, workspace)} has an extraneous dependency on ${structUtils.prettyIdent(configuration, dependencyIdent)}`);
          }
        }
      }
  
      for (const {workspace, dependencyIdent, reason} of result.invalidDependencies) {
        const dependencyDescriptor = workspace.manifest.dependencies.get(dependencyIdent.identHash);
        const devDependencyDescriptor = workspace.manifest.devDependencies.get(dependencyIdent.identHash);

        if (dependencyDescriptor || devDependencyDescriptor) {
          report.reportError(MessageName.CONSTRAINTS_INVALID_DEPENDENCY, `${structUtils.prettyWorkspace(configuration, workspace)} has an invalid dependency on ${structUtils.prettyIdent(configuration, dependencyIdent)} (invalid because ${reason})`);
        }
      }
    });

    return report.exitCode();
  });
