import execa = require('execa');

import {Configuration, Project, Workspace, Cache, Locator, Manifest} from '@berry/core';
import {runShell}                                                    from '@berry/shell'
// @ts-ignore: Need to write the definition file
import {UsageError}                                                  from '@manaflair/concierge';
import {resolve}                                                     from 'path';
import {Readable, Writable}                                          from 'stream';

import * as execUtils                                                from '../utils/execUtils';
import {plugins}                                                     from '../plugins';

import {getDependencyBinaries}                                       from './bin';

export default (concierge: any) => concierge

  .command(`run <name> [... args]`)
  .describe(`run a script defined in the package.json`)
  .flags({proxyArguments: true})

  .action(async ({cwd, stdin, stdout, stderr, name, args}: {cwd: string, stdin: Readable, stdout: Writable, stderr: Writable, name: string, args: Array<string>}) => {
    const configuration = await Configuration.find(cwd, plugins);
    const {project, workspace} = await Project.find(configuration, cwd);
    const cache = await Cache.find(configuration);

    const script = workspace.manifest.scripts.get(name);

    if (script) {
      try {
        await runShell(script, {cwd: workspace.cwd, args: args, stdin, stdout, stderr});
      } catch {
        return 1;
      }

      return 0;
    }

    const binaries = await getDependencyBinaries({configuration, project, workspace, cache});
    const binary = binaries.get(name);

    if (binary) {
      const [pkg, file] = binary;

      const fetcher = configuration.makeFetcher();
      const pkgFs = await fetcher.fetch(pkg, {cache, fetcher, project});
      const target = resolve(pkgFs.getRealPath(), file);

      return await execUtils.execFile(process.execPath, [`--require`, configuration.pnpPath, target, ... args], {cwd: process.cwd(), stdin, stdout, stderr});
    }

    throw new UsageError(`Couldn't find a script named "${name}"`);
  });
