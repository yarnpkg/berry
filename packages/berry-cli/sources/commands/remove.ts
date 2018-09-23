import {Configuration, Cache, Project, Report} from '@berry/core';
import {structUtils}                           from '@berry/core';

import {plugins}                               from '../plugins';

export default (concierge: any) => concierge

  .command(`remove [... names]`)
  .describe(`remove dependencies from the project`)

  .action(async ({stdout, names}: {stdout: NodeJS.WritableStream, names: Array<string>}) => {
    const configuration = await Configuration.find(process.cwd());
    const {project, workspace} = await Project.find(configuration, process.cwd());
    const cache = await Cache.find(configuration);

    const report = await Report.start({project, cache}, async () => {
      for (const entry of names) {
        const ident = structUtils.parseIdent(entry);
        workspace.manifest.dependencies.delete(ident.identHash);
      }

      await project.install({cache});
      await project.persist();
    });

    stdout.write(`${report}\n`);
  });
