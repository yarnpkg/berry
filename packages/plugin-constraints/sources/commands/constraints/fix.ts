import {Cache, Configuration, Descriptor, Project, PluginConfiguration} from '@berry/core';
import {MessageName, StreamReport}                                      from '@berry/core';
import {structUtils}                                                    from '@berry/core';
import { PortablePath }                                                 from '@berry/fslib';
import {Readable, Writable}                                             from 'stream';

import {Constraints}                                                    from '../../Constraints';

// eslint-disable-next-line arca/no-default-export
export default (clipanion: any, pluginConfiguration: PluginConfiguration) => clipanion

  .command(`constraints fix`)

  .categorize(`Constraints-related commands`)
  .describe(`make the project constraint-compliant if possible`)

  .detail(`
    This command will run constraints on your project and try its best to automatically fix any error it finds. If some errors cannot be automatically fixed (in particular all errors triggered by \`gen_invalid_dependency\` rules) the process will exit with a non-zero exit code, and an install will be automatically be ran otherwise.

    For more information as to how to write constraints, please consult our dedicated page on our website: .
  `)

  .example(
    `Automatically fix as many things as possible in your project`,
    `yarn constraints fix`,
  )

  .action(async ({cwd, stdin, stdout}: {cwd: PortablePath, stdin: Readable, stdout: Writable}) => {
    const configuration = await Configuration.find(cwd, pluginConfiguration);
    const {project} = await Project.find(configuration, cwd);
    const cache = await Cache.find(configuration);
    const constraints = await Constraints.find(project);

    const result = await constraints.process();

    let modified = false;

    for (const {workspace, dependencyIdent, dependencyRange, dependencyType} of result.enforcedDependencies) {
      if (dependencyRange !== null) {
        const newDescriptor = structUtils.makeDescriptor(dependencyIdent, dependencyRange);

        const descriptor = workspace.manifest[dependencyType].get(dependencyIdent.identHash);
        if (typeof descriptor !== `undefined` && descriptor.range !== dependencyRange)
          continue;

        workspace.manifest[dependencyType].set(dependencyIdent.identHash, newDescriptor);
        modified = true;
      } else {
        const descriptor = workspace.manifest[dependencyType].get(dependencyIdent.identHash);
        if (typeof descriptor === `undefined`)
          continue;

        workspace.manifest[dependencyType].delete(dependencyIdent.identHash);
        modified = true;
      }

      await workspace.persistManifest();
    }

    let globalExitCode;

    if (result.invalidDependencies) {
      const report = await StreamReport.start({configuration, stdout}, async report => {
        for (const {workspace, dependencyIdent, dependencyType, reason} of result.invalidDependencies) {
          const dependencyDescriptor = workspace.manifest[dependencyType].get(dependencyIdent.identHash);

          if (dependencyDescriptor) {
            report.reportError(MessageName.CONSTRAINTS_INVALID_DEPENDENCY, `${structUtils.prettyWorkspace(configuration, workspace)} has an unfixable invalid dependency on ${structUtils.prettyIdent(configuration, dependencyIdent)} in ${dependencyType} (invalid because ${reason})`);
          }
        }
      });

      const exitCode = report.exitCode();
      if (typeof globalExitCode === `undefined` && exitCode !== 0) {
        globalExitCode = exitCode;
      }
    }

    if (modified) {
      if (result.invalidDependencies)
        stdout.write(`\n`);

      const report = await StreamReport.start({configuration, stdout}, async report => {
        await project.install({cache, report});
      });

      const exitCode = report.exitCode();
      if (typeof globalExitCode === `undefined` && exitCode !== 0) {
        globalExitCode = exitCode;
      }
    }

    return globalExitCode;
  });
