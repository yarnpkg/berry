import {Configuration, Descriptor, Project, Plugin} from '@berry/core';
import {structUtils}                                from '@berry/core';
import inquirer                                     from 'inquirer';
import emoji                                        from 'node-emoji';
import {Readable, Writable}                         from 'stream';

import {Constraints}                                from '../../Constraints';

export default (concierge: any, plugins: Map<string, Plugin>) => concierge

  .command(`constraints apply`)

  .categorize(`Constraints-related commands`)
  .describe(`apply the project constraints`)

  .action(async ({cwd, stdin, stdout}: {cwd: string, stdin: Readable, stdout: Writable}) => {
    const configuration = await Configuration.find(cwd, plugins);
    const {project} = await Project.find(configuration, cwd);
    const constraints = await Constraints.find(project);

    const result = await constraints.process();

    // @ts-ignore
    const prompt = inquirer.createPromptModule({
      input: stdin,
      output: stdout,
    });

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
          }
        }
      }
    }
  });
