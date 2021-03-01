import {BaseCommand}            from '@yarnpkg/cli';
import {Configuration, Project} from '@yarnpkg/core';
import {Command, Option, Usage} from 'clipanion';

import {Constraints}            from '../../Constraints';

// eslint-disable-next-line arca/no-default-export
export default class ConstraintsSourceCommand extends BaseCommand {
  static paths = [
    [`constraints`, `source`],
  ];

  static usage: Usage = Command.Usage({
    category: `Constraints-related commands`,
    description: `print the source code for the constraints`,
    details: `
      This command will print the Prolog source code used by the constraints engine. Adding the \`-v,--verbose\` flag will print the *full* source code, including the fact database automatically compiled from the workspace manifests.
    `,
    examples: [[
      `Prints the source code`,
      `yarn constraints source`,
    ], [
      `Print the source code and the fact database`,
      `yarn constraints source -v`,
    ]],
  });

  verbose = Option.Boolean(`-v,--verbose`, false, {
    description: `Also print the fact database automatically compiled from the workspace manifests`,
  });

  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project} = await Project.find(configuration, this.context.cwd);
    const constraints = await Constraints.find(project);

    this.context.stdout.write(this.verbose ? constraints.fullSource : constraints.source);
  }
}
