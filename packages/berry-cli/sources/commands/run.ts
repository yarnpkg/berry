import execa = require('execa');

import {Configuration, Project} from '@berry/core';
import {runShell}               from '@berry/shell'
// @ts-ignore: Need to write the definition file
import {UsageError, flags}      from '@manaflair/concierge';
import {Readable, Writable}     from 'stream';

import {plugins}                from '../plugins';

export default (concierge: any) => concierge

  .command(`run <name> [... args]`)
  .describe(`run a script defined in the package.json`)
  .flags({proxyArguments: true})

  .action(async ({stdin, stdout, stderr, name, args}: {stdin: Readable, stdout: Writable, stderr: Writable, name: string, args: Array<string>}) => {
    const configuration = await Configuration.find(process.cwd(), plugins);
    const {project, workspace} = await Project.find(configuration, process.cwd());

    const source = workspace.scripts.get(name);

    if (source === undefined)
      throw new UsageError(`Couldn't find a script named "${name}"`);

    try {
      await runShell(source, {
        args: args,
        stdin, stdout, stderr
      });
    } catch (error) {
    // @ts-ignore
//    console.log(process._getActiveHandles());
      return 1;
    }
  });
