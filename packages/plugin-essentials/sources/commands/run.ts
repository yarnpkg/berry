import {Configuration, Plugin, Project, Workspace, Manifest, Cache} from '@berry/core';
import {scriptUtils}                                                from '@berry/core';
// @ts-ignore: Need to write the definition file
import {UsageError}                                                 from '@manaflair/concierge';
import {Readable, Writable}                                         from 'stream';

import {LightReport}                                                from '../LightReport';

export default (concierge: any, plugins: Map<string, Plugin>) => concierge

  .command(`run <name> [... args]`)
  .describe(`run a script defined in the package.json`)
  .flags({proxyArguments: true})

  .action(async ({cwd, stdin, stdout, stderr, name, args}: {cwd: string, stdin: Readable, stdout: Writable, stderr: Writable, name: string, args: Array<string>}) => {
    const configuration = await Configuration.find(cwd, plugins);
    const {project, workspace} = await Project.find(configuration, cwd);
    const cache = await Cache.find(configuration);

    const report = await LightReport.start({configuration, stdout}, async (report: LightReport) => {
      await project.resolveEverything({lockfileOnly: true, cache, report});
    });

    if (report.hasErrors())
      return 1;

    // First we check to see whether a script exist inside the current workspace
    // for the given name

    const manifest = await Manifest.find(workspace.cwd);

    if (manifest.scripts.has(name)) {
      try {
        return await scriptUtils.executeWorkspaceScript(workspace, name, args, {stdin, stdout, stderr});
      } catch (error) {
        if (error.cmd) {
          return 1;
        } else {
          throw error;
        }
      }
    }

    // If we can't find it, we then check whether one of the dependencies of the
    // current workspace exports a binary with the requested name

    const binaries = await scriptUtils.getWorkspaceAccessibleBinaries(workspace);
    const binary = binaries.get(name);

    if (binary) {
      try {
        return await scriptUtils.executeWorkspaceAccessibleBinary(workspace, name, args, {cwd, stdin, stdout, stderr});
      } catch (error) {
        if (error.cmd) {
          return 1;
        } else {
          throw error;
        }
      }
    }

    // When it fails, we try to check whether it's a global script (ie we look
    // into all the workspaces to find one that exports this script). We only do
    // this if the script name contains a colon character (":"), and we skip
    // this logic if multiple workspaces share the same script name.

    if (name.includes(`:`)) {
      let candidateWorkspaces = await Promise.all(project.workspaces.map(async workspace => {
        const manifest = await Manifest.find(workspace.cwd);
        return manifest.scripts.has(name) ? workspace : null;
      }));

      let filteredWorkspaces = candidateWorkspaces.filter(workspace => {
        return workspace !== null;
      }) as Array<Workspace>;

      if (filteredWorkspaces.length === 1) {
        try {
          return await scriptUtils.executeWorkspaceScript(filteredWorkspaces[0], name, args, {stdin, stdout, stderr});
        } catch (error) {
          if (error.cmd) {
            return 1;
          } else {
            throw error;
          }
        }
      }
    }

    throw new UsageError(`Couldn't find a script named "${name}"`);
  });
