import {Cache, Configuration, Descriptor, Project, PluginConfiguration} from '@berry/core';
import {MessageName, StreamReport}                                      from '@berry/core';
import {structUtils}                                                    from '@berry/core';
import inquirer                                                         from 'inquirer';
import {Readable, Writable}                                             from 'stream';

import {Constraints}                                                    from '../../Constraints';

export default (concierge: any, pluginConfiguration: PluginConfiguration) => concierge

  .command(`constraints fix`)

  .categorize(`Constraints-related commands`)
  .describe(`make the project constraint-compliant if possible`)

  .detail(`
    This command will run constraints on your project and try its best to automatically fix any error it finds. If some errors cannot be automatically fixed (in particular all errors triggered by \`gen_invalid_dependency\` rules) the process will exit with a non-zero exit code, and an install will be automatically be ran otherwise.

    For more information as to how to write constraints, please consult our dedicated page on our website: .
  `)

  .example(
    `Automatically fixes as many things as possible in your project`,
    `yarn constraints fix`,
  )

  .action(async ({cwd, stdin, stdout}: {cwd: string, stdin: Readable, stdout: Writable}) => {
    const configuration = await Configuration.find(cwd, pluginConfiguration);
    const {project} = await Project.find(configuration, cwd);
    const cache = await Cache.find(configuration);
    const constraints = await Constraints.find(project);

    const result = await constraints.process();

    // @ts-ignore
    const prompt = inquirer.createPromptModule({
      input: stdin,
      output: stdout,
    });

    let modified = false;

    for (const {workspace, dependencyIdent, dependencyRange} of result.enforcedDependencyRanges) {
      if (dependencyRange !== null) {
        const invalidDependencies = Array.from(workspace.manifest.dependencies.values()).filter((dependency: Descriptor) => {
          return structUtils.areIdentsEqual(dependency, dependencyIdent) && dependency.range !== dependencyRange;
        });

        for (const invalid of invalidDependencies) {
          const result = await prompt({
            type: `confirm`,
            name: `confirmed`,
            message: `${structUtils.prettyLocator(configuration, workspace.locator)}: Change ${structUtils.prettyIdent(configuration, invalid)} into ${structUtils.prettyRange(configuration, dependencyRange)}?`,
          });

          // @ts-ignore
          if (result.confirmed) {
            const newDescriptor = structUtils.makeDescriptor(invalid, dependencyRange);

            workspace.manifest.dependencies.delete(invalid.identHash);
            workspace.manifest.dependencies.set(newDescriptor.identHash, newDescriptor);

            modified = true;
          }
        }
      } else {
        const invalidDependencies = Array.from(workspace.manifest.dependencies.values()).filter((dependency: Descriptor) => {
          return structUtils.areIdentsEqual(dependency, dependencyIdent);
        });

        for (const invalid of invalidDependencies) {
          const result = await prompt({
            type: `confirm`,
            name: `confirmed`,
            message: `${structUtils.prettyLocator(configuration, workspace.locator)}: Remove ${structUtils.prettyDescriptor(configuration, invalid)} from the dependencies?`,
          });

          // @ts-ignore
          if (result.confirmed) {
            workspace.manifest.dependencies.delete(invalid.identHash);

            modified = true;
          }
        }
      }
    }

    if (result.invalidDependencies) {
      if (modified)
        stdout.write(`\n`);

      const report = await StreamReport.start({configuration, stdout}, async (report: StreamReport) => {
        for (const {workspace, dependencyIdent, reason} of result.invalidDependencies) {
          const dependencyDescriptor = workspace.manifest.dependencies.get(dependencyIdent.identHash);
          const devDependencyDescriptor = workspace.manifest.devDependencies.get(dependencyIdent.identHash);
  
          if (dependencyDescriptor || devDependencyDescriptor) {
            report.reportError(MessageName.CONSTRAINTS_INVALID_DEPENDENCY, `${structUtils.prettyWorkspace(configuration, workspace)} has an unfixable invalid dependency on ${structUtils.prettyIdent(configuration, dependencyIdent)} (invalid because ${reason})`);
          }
        }
      });

      return report.exitCode();
    }

    if (modified) {
      stdout.write(`\n`);

      const report = await StreamReport.start({configuration, stdout}, async (report: StreamReport) => {
        await project.install({cache, report});
      });

      return report.exitCode();
    }
  });
