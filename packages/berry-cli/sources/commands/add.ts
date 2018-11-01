import {Configuration, Cache, Project, Report} from '@berry/core';
import {structUtils}                           from '@berry/core';
import {Writable}                              from 'stream';

import {plugins}                               from '../plugins';

export default (concierge: any) => concierge

  .command(`add [... packages]`)
  .describe(`add dependencies to the project`)

  .action(async ({cwd, stdout, packages}: {cwd: string, stdout: Writable, packages: Array<string>}) => {
    const configuration = await Configuration.find(cwd, plugins);
    const {project, workspace} = await Project.find(configuration, cwd);
    const cache = await Cache.find(configuration);

    const report = await Report.start({project, cache}, async () => {
      for (const entry of packages) {
        const descriptor = structUtils.parseDescriptor(entry);
        workspace.manifest.dependencies.set(descriptor.identHash, descriptor);
      }

      await project.install({cache});
      await project.persist();
    });

    stdout.write(report);

    return project.errors.length === 0 ? 0 : 1;
  });
