import {WorkspaceRequiredError}                              from '@berry/cli';
import {Configuration, Cache, Plugin, Project, StreamReport} from '@berry/core';
// @ts-ignore
import {UsageError}                                          from '@manaflair/concierge';
import {Writable}                                            from 'stream';

import {registerLegacyYarnResolutions}                       from '../utils/miscUtils';

export default (concierge: any, plugins: Map<string, Plugin>) => concierge

  .command(`install [-f]`)
  .describe(`install the project dependencies`)

  .action(async ({cwd, stdout}: {cwd: string, stdout: Writable}) => {
    const configuration = await Configuration.find(cwd, plugins);
    const {project, workspace} = await Project.find(configuration, cwd);
    const cache = await Cache.find(configuration);

    if (!workspace)
      throw new WorkspaceRequiredError(cwd);

    const report = await StreamReport.start({configuration, stdout}, async (report: StreamReport) => {
      await registerLegacyYarnResolutions(project);

      await project.install({cache, report});
    });

    return report.hasErrors() ? 1 : 0;
  });
