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

async function makeExtraPaths() {
  const runPath = await execUtils.makePathWrapper(`run`, process.execPath, [process.argv[1], `run`]);
  const berryPath = await execUtils.makePathWrapper(`berry`, process.execPath, [process.argv[1]]);
  const nodePath = await execUtils.makePathWrapper(`node`, process.execPath);

  return [runPath, berryPath, nodePath];
}

function makeRunnerForWorkspace(workspace: Workspace, name: string) {
  const script = workspace.manifest.scripts.get(name);

  if (!script)
    return null;
  
  return async ({args, stdin, stdout, stderr}: {args: Array<string>, stdin: Readable, stdout: Writable, stderr: Writable}) => {
    try {
      await runShell(script, {cwd: workspace.cwd, args: args, stdin, stdout, stderr, paths: await makeExtraPaths()});
    } catch {
      return 1;
    }

    return 0;
  };
}

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

    const runner = makeRunnerForWorkspace(workspace, name);

    if (runner)
      return await runner({args, stdin, stdout, stderr});

    // If we can't find it, we then check whether one of the dependencies of the
    // current workspace exports a binary with the requested name

    const binaries = await getDependencyBinaries({configuration, project, workspace, cache});
    const binary = binaries.get(name);

    if (binary) {
      const [pkg, file] = binary;

      const fetcher = configuration.makeFetcher();
      const pkgFs = await fetcher.fetch(pkg, {cache, fetcher, project});
      const target = resolve(pkgFs.getRealPath(), file);

      return await execUtils.execFile(process.execPath, [`--require`, configuration.pnpPath, target, ... args], {cwd: process.cwd(), stdin, stdout, stderr, paths: await makeExtraPaths()});
    }

    // When it fails, we try to check whether it's a global script (ie we look
    // into all the workspaces to find one that exports this script). We only do
    // this if the script name contains a colon character (":"), and we skip
    // this logic if multiple workspaces share the same script name.
    
    if (name.includes(`:`)) {
      let runners = await Promise.all(project.workspaces.map(workspace => {
        return makeRunnerForWorkspace(workspace, name);
      }));

      runners = runners.filter(runner => runner);

      if (runners.length === 1) {
        const runner = runners[0];

        if (!runner)
          throw new Error(`There should be a runner`);

        return await runner({args, stdin, stdout, stderr});
      }
    }

    throw new UsageError(`Couldn't find a script named "${name}"`);
  });
