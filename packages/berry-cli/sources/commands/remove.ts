import {Configuration, Cache, Project, StreamReport} from '@berry/core';
import {structUtils}                                 from '@berry/core';
import {Writable}                                    from 'stream';

import {registerLegacyYarnResolutions}               from '../utils/miscUtils';

import {plugins}                                     from '../plugins';

export default (concierge: any) => concierge

  .command(`remove [... names]`)
  .describe(`remove dependencies from the project`)

  .action(async ({cwd, stdout, names}: {cwd: string, stdout: Writable, names: Array<string>}) => {
    const configuration = await Configuration.find(cwd, plugins);
    const {project, workspace} = await Project.find(configuration, cwd);
    const cache = await Cache.find(configuration);

    const report = await StreamReport.start({stdout}, async (report: StreamReport) => {
      await registerLegacyYarnResolutions(project);

      for (const entry of names) {
        const ident = structUtils.parseIdent(entry);

        workspace.manifest.dependencies.delete(ident.identHash);
        workspace.manifest.devDependencies.delete(ident.identHash);
        workspace.manifest.peerDependencies.delete(ident.identHash);
      }

      await project.install({cache, report});
      await project.persist();
    });

    return report.hasErrors() ? 1 : 0;
  });
