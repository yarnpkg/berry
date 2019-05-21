import {Configuration, Project, PluginConfiguration} from '@berry/core';
import {PortablePath}                                from '@berry/fslib';
import {Writable}                                    from 'stream';

import {Constraints}                                 from '../../Constraints';

// eslint-disable-next-line arca/no-default-export
export default (clipanion: any, pluginConfiguration: PluginConfiguration) => clipanion

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
    `Print the source code and the fact database`,
    `yarn constraints source -v`,
  )

  .action(async ({cwd, stdout, verbose}: {cwd: PortablePath, stdout: Writable, verbose: boolean}) => {
    const configuration = await Configuration.find(cwd, pluginConfiguration);
    const {project} = await Project.find(configuration, cwd);
    const constraints = await Constraints.find(project);

    stdout.write(verbose ? constraints.fullSource : constraints.source);
  });
