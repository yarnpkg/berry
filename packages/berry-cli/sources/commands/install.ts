import Joi = require('joi');

import {Configuration, Cache, Project, Report} from '@berry/core';

import {plugins}                               from '../plugins';

export default (concierge: any) => concierge

  .command(`install [-f] [--cwd PATH]`)
  .describe(`install the project's dependencies`)

  .validate(Joi.object().unknown().keys({
    cwd: Joi.string().default(process.cwd()),
  }))

  .action(async ({cwd, stdout}: {cwd: string, stdout: NodeJS.WritableStream}) => {
    const configuration = await Configuration.find(cwd, plugins);
    const {project} = await Project.find(configuration, process.cwd());
    const cache = await Cache.find(configuration);

    const report = await Report.start({project, cache}, async () => {
      await project.install({cache});
      await project.persist();
    });

    stdout.write(`${report}\n`);
  });
