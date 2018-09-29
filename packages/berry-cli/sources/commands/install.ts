import {Configuration, Cache, Project, Report} from '@berry/core';
import {structUtils}                           from '@berry/core';

import {plugins}                               from '../plugins';

export default (concierge: any) => concierge

  .command(`install`)
  .describe(`install the project's dependencies`)

  .action(async ({stdout}: {stdout: NodeJS.WritableStream}) => {
    const configuration = await Configuration.find(process.cwd(), plugins);
    const {project, workspace} = await Project.find(configuration, process.cwd());
    const cache = await Cache.find(configuration);

    const report = await Report.start({project, cache}, async () => {
      await project.install({cache});
      await project.persist();
    });

    stdout.write(`${report}\n`);
  });
