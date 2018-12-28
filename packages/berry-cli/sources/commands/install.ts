import {Configuration, Cache, Project, StreamReport} from '@berry/core';
import {Writable}                                    from 'stream';

import {registerLegacyYarnResolutions}               from '../utils/miscUtils';

import {plugins}                                     from '../plugins';

export default (concierge: any) => concierge

  .command(`install [-f]`)
  .describe(`install the project dependencies`)

  .action(async ({cwd, stdout}: {cwd: string, stdout: Writable}) => {
    const configuration = await Configuration.find(cwd, plugins);
    const {project} = await Project.find(configuration, cwd);
    const cache = await Cache.find(configuration);

    const report = await StreamReport.start({stdout}, async (report: StreamReport) => {
      await registerLegacyYarnResolutions(project);

      await project.install({cache, report});
      await project.persist();
    });

    return report.hasErrors() ? 1 : 0;
  });
