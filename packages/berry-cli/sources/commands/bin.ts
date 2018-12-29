import {Configuration, Project, Cache} from '@berry/core';
import {scriptUtils}                   from '@berry/core';
// @ts-ignore: Need to write the definition file
import {UsageError}                    from '@manaflair/concierge';
import {resolve}                       from 'path';
import {Writable}                      from 'stream';

import {plugins}                       from '../plugins';

export default (concierge: any) => concierge

  .command(`bin [name]`)
  .describe(`get the path to a binary script`)

  .action(async ({cwd, stdout, name}: {cwd: string, stdout: Writable, name: string}) => {
    const configuration = await Configuration.find(cwd, plugins);
    const {project, workspace} = await Project.find(configuration, cwd);
    const cache = await Cache.find(configuration);

    const binaries = await scriptUtils.getWorkspaceAccessibleBinaries(workspace);

    if (name) {
      const binary = binaries.get(name);

      if (!binary)
        throw new UsageError(`Couldn't find a binary named "${name}"`);

      const [pkg, binaryFile] = binary;
      stdout.write(`${binaryFile}\n`);
    } else {
      for (const name of binaries.keys()) {
        stdout.write(`${name}\n`);
      }
    }
  });
