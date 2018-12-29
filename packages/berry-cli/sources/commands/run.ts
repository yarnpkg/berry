import execa = require('execa');

import {Configuration, Project, Workspace, Cache, Locator, Manifest} from '@berry/core';
import {scriptUtils}                                                 from '@berry/core';
import {runShell}                                                    from '@berry/shell'
import {NodeFS}                                                      from '@berry/zipfs';
// @ts-ignore: Need to write the definition file
import {UsageError}                                                  from '@manaflair/concierge';
import {existsSync}                                                  from 'fs';
import {delimiter, resolve}                                          from 'path';
import {Readable, Writable}                                          from 'stream';

import * as execUtils                                                from '../utils/execUtils';
import {plugins}                                                     from '../plugins';

export default (concierge: any) => concierge

  .command(`run <name> [... args]`)
  .describe(`run a script defined in the package.json`)
  .flags({proxyArguments: true})

  .action(async ({cwd, stdin, stdout, stderr, name, args}: {cwd: string, stdin: Readable, stdout: Writable, stderr: Writable, name: string, args: Array<string>}) => {
    const configuration = await Configuration.find(cwd, plugins);
    const {project, workspace} = await Project.find(configuration, cwd);
    const cache = await Cache.find(configuration);

    // First we check to see whether a script exist inside the current workspace
    // for the given name

    const manifest = await Manifest.fromFile(`${workspace.cwd}/package.json`);

    if (manifest.scripts.has(name))
      return await scriptUtils.executeWorkspaceScript(workspace, name, args, {cache, stdin, stdout, stderr});

    // If we can't find it, we then check whether one of the dependencies of the
    // current workspace exports a binary with the requested name

    const binaries = await scriptUtils.getWorkspaceAccessibleBinaries(workspace);
    const binary = binaries.get(name);

    if (binary)
      return await scriptUtils.executeWorkspaceAccessibleBinary(workspace, name, args, {cwd, stdin, stdout, stderr});

    // When it fails, we try to check whether it's a global script (ie we look
    // into all the workspaces to find one that exports this script). We only do
    // this if the script name contains a colon character (":"), and we skip
    // this logic if multiple workspaces share the same script name.

    if (name.includes(`:`)) {
      let candidateWorkspaces = await Promise.all(project.workspaces.map(async workspace => {
        const manifest = await Manifest.fromFile(`${workspace.cwd}/package.json`);
        return manifest.scripts.has(name) ? workspace : null;
      }));

      let filteredWorkspaces = candidateWorkspaces.filter(workspace => {
        return workspace !== null;
      }) as Array<Workspace>;

      if (filteredWorkspaces.length === 1) {
        return await scriptUtils.executeWorkspaceScript(filteredWorkspaces[0], name, args, {cache, stdin, stdout, stderr});
      }
    }

    throw new UsageError(`Couldn't find a script named "${name}"`);
  });
