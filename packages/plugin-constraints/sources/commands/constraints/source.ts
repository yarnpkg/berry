import {Configuration, Project, Plugin} from '@berry/core';
import {Writable}                       from 'stream';

import {Constraints}                    from '../../Constraints';

export default (concierge: any, plugins: Map<string, Plugin>) => concierge

  .command(`constraints source [-v,--verbose]`)

  .categorize(`Constraints-related commands`)
  .describe(`print the source code for the constraints`)

  .detail(`
    This command will print the Prolog source code used by the constraints engine. Adding the \`-v,--verbose\` flag will print the *full* source code, including the fact database automatically compiled from your workspaces manifests.
  `)

  .example(
    `Prints the source code`,
    `yarn constraints source`,
  )

  .example(
    `Prints the source code and the fact database`,
    `yarn constraints source -v`,
  )

  .action(async ({cwd, stdout, verbose}: {cwd: string, stdout: Writable, verbose: boolean}) => {
    const configuration = await Configuration.find(cwd, plugins);
    const {project} = await Project.find(configuration, cwd);
    const constraints = await Constraints.find(project);

    stdout.write(verbose ? constraints.fullSource : constraints.source);
  });
