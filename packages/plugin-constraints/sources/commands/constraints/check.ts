import {Configuration, Descriptor, Project, PluginConfiguration} from '@berry/core';
import {MessageName, StreamReport}                               from '@berry/core';
import {structUtils}                                             from '@berry/core';
import {Writable}                                                from 'stream';

import {Constraints}                                             from '../../Constraints';

// eslint-disable-next-line arca/no-default-export
export default (clipanion: any, pluginConfiguration: PluginConfiguration) => clipanion

  .command(`constraints check`)

  .categorize(`Constraints-related commands`)
  .describe(`check that the project constraints are met`)

  .detail(`
    This command will run constraints on your project and emit errors for each one that is found but isn't met. If any error is emitted the process will exit with a non-zero exit code.

    For more information as to how to write constraints, please consult our dedicated page on our website: .
  `)

  .example(
    `Check that all constraints are satisfied`,
    `yarn constraints check`,
  )

  .action(async ({cwd, stdout}: {cwd: string, stdout: Writable}) => {
    const configuration = await Configuration.find(cwd, pluginConfiguration);
    const {project} = await Project.find(configuration, cwd);
    const constraints = await Constraints.find(project);

    const report = await StreamReport.start({configuration, stdout}, async report => {
      const result = await constraints.process();
    
      for (const {workspace, dependencyIdent, dependencyRange, dependencyType} of result.enforcedDependencyRanges) {
        const dependencyDescriptor = workspace.manifest[dependencyType].get(dependencyIdent.identHash);

        if (dependencyRange !== null) {
          const constraintDescriptor = structUtils.makeDescriptor(dependencyIdent, dependencyRange);

          if (!dependencyDescriptor) {
            report.reportError(MessageName.CONSTRAINTS_MISSING_DEPENDENCY, `${structUtils.prettyWorkspace(configuration, workspace)} must depend on ${structUtils.prettyIdent(configuration, dependencyIdent)} (via ${structUtils.prettyRange(configuration, dependencyRange)}) in ${dependencyType}, but doesn't`);
          } else if (dependencyDescriptor.range !== dependencyRange) {
            report.reportError(MessageName.CONSTRAINTS_INCOMPATIBLE_DEPENDENCY, `${structUtils.prettyWorkspace(configuration, workspace)} must depend on ${structUtils.prettyIdent(configuration, dependencyIdent)} via ${structUtils.prettyRange(configuration, dependencyRange)} in ${dependencyType}, but uses ${structUtils.prettyRange(configuration, dependencyDescriptor.range)} instead`);
          }
        } else {
          if (dependencyDescriptor) {
            report.reportError(MessageName.CONSTRAINTS_EXTRANEOUS_DEPENDENCY, `${structUtils.prettyWorkspace(configuration, workspace)} has an extraneous dependency on ${structUtils.prettyIdent(configuration, dependencyIdent)} in ${dependencyType}`);
          }
        }
      }
  
      for (const {workspace, dependencyIdent, dependencyType, reason} of result.invalidDependencies) {
        const dependencyDescriptor = workspace.manifest[dependencyType].get(dependencyIdent.identHash);

        if (dependencyDescriptor) {
          report.reportError(MessageName.CONSTRAINTS_INVALID_DEPENDENCY, `${structUtils.prettyWorkspace(configuration, workspace)} has an invalid dependency on ${structUtils.prettyIdent(configuration, dependencyIdent)} in ${dependencyType} (invalid because ${reason})`);
        }
      }
    });

    return report.exitCode();
  });
