import {Configuration, Project, Workspace, Cache, Locator, Manifest} from '@berry/core';
import {scriptUtils}                                                 from '@berry/core';
import {NodeFS}                                                      from '@berry/zipfs';
// @ts-ignore: Need to write the definition file
import {UsageError}                                                  from '@manaflair/concierge';
import {resolve}                                                     from 'path';
import {Writable}                                                    from 'stream';

import {plugins}                                                     from '../plugins';

export default (concierge: any) => concierge

  .command(`bin <name>`)
  .describe(`get the path to a binary script`)

  .action(async ({cwd, stdout, name}: {cwd: string, stdout: Writable, name: string}) => {
    const configuration = await Configuration.find(cwd, plugins);
    const {project, workspace} = await Project.find(configuration, cwd);
    const cache = await Cache.find(configuration);

    const binaries = await scriptUtils.getWorkspaceAccessibleBinaries(workspace, {cache});
    const binary = binaries.get(name);

    if (!binary)
      throw new UsageError(`Couldn't find a binary named "${name}"`);

    const [pkg, packageFs, file] = binary;
    const target = resolve(packageFs.getRealPath(), file);

    stdout.write(`${target}\n`);
  });
