import {Configuration, Project, Plugin} from '@berry/core';
import {Writable}                       from 'stream';

import {Constraints}                    from '../../Constraints';

export default (concierge: any, plugins: Map<string, Plugin>) => concierge

  .command(`constraints source [--full]`)

  .categorize(`Constraint commands`)
  .describe(`print the source code for the constraints`)

  .action(async ({cwd, stdout, full}: {cwd: string, stdout: Writable, full: boolean}) => {
    const configuration = await Configuration.find(cwd, plugins);
    const {project} = await Project.find(configuration, cwd);
    const constraints = await Constraints.find(project);

    stdout.write(full ? constraints.fullSource : constraints.source);
  });
