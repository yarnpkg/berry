import {Configuration, Cache, Project, Report} from '@berry/core';
import {Writable}                              from 'stream';

import {registerLegacyYarnResolutions}         from '../utils/miscUtils';

import {plugins}                               from '../plugins';

export default (concierge: any) => concierge

  .command(`install [-f]`)
  .describe(`install the project dependencies`)

  .action(async ({cwd, stdout}: {cwd: string, stdout: Writable}) => {
    const configuration = await Configuration.find(cwd, plugins);
    const {project} = await Project.find(configuration, cwd);
    const cache = await Cache.find(configuration);

    const report = await Report.start({project, cache}, async () => {
      await registerLegacyYarnResolutions(project);

      await project.install({cache});
      await project.persist();
    });

    stdout.write(report);

    return project.errors.length === 0 ? 0 : 1;
  });
