import {Configuration, Plugin, Project, Workspace, Manifest, Cache} from '@berry/core';
import {LightReport, ThrowReport}                                   from '@berry/core';
import {scriptUtils}                                                from '@berry/core';
// @ts-ignore
import {UsageError}                                                 from '@manaflair/concierge';
import {Readable, Writable}                                         from 'stream';

export default (concierge: any, plugins: Map<string, Plugin>) => concierge

  .command(`run <name> [... args]`)
  .describe(`run a script defined in the package.json`)
  .flags({proxyArguments: true})

  .detail(`
    This command will run a tool. The exact tool that will be executed will depend on the current state of your workspace:

    - If the \`scripts\` field from your local package.json contains a matching script name, its definition will get executed.

    - Otherwise, if one of the local workspace's dependencies exposes a binary with a matching name, this binary will get executed.

    - Otherwise, if the specified name contains a colon character and if one of the workspaces in the project contains exactly one script with a matching name, then this script will get executed.

    Whatever happens, the cwd of the spawned process will be the workspace that declares the script (which makes it possible to call commands cross-workspaces using the third syntax).
  `)

  .action(async ({cwd, stdin, stdout, stderr, name, args}: {cwd: string, stdin: Readable, stdout: Writable, stderr: Writable, name: string, args: Array<string>}) => {
    const configuration = await Configuration.find(cwd, plugins);
    const {project, workspace, locator} = await Project.find(configuration, cwd);
    const cache = await Cache.find(configuration);

    const report = await LightReport.start({configuration, stdout}, async (report: LightReport) => {
      await project.resolveEverything({lockfileOnly: true, cache, report});
    });

    if (report.hasErrors())
      return 1;

    // First we check to see whether a script exist inside the current workspace
    // for the given name

    if (await scriptUtils.hasPackageScript(locator, name, {project}))
      return await scriptUtils.executePackageScript(locator, name, args, {project, stdin, stdout, stderr});

    // If we can't find it, we then check whether one of the dependencies of the
    // current workspace exports a binary with the requested name

    const binaries = await scriptUtils.getPackageAccessibleBinaries(locator, {project});
    const binary = binaries.get(name);

    if (binary)
      return await scriptUtils.executePackageAccessibleBinary(locator, name, args, {cwd, project, stdin, stdout, stderr});

    // When it fails, we try to check whether it's a global script (ie we look
    // into all the workspaces to find one that exports this script). We only do
    // this if the script name contains a colon character (":"), and we skip
    // this logic if multiple workspaces share the same script name.
    // 
    // We also disable this logic for packages coming from third-parties (ie
    // not workspaces). Not particular reason except maybe security concerns.

    if (workspace && name.includes(`:`)) {
      let candidateWorkspaces = await Promise.all(project.workspaces.map(async workspace => {
        return workspace.manifest.scripts.has(name) ? workspace : null;
      }));

      let filteredWorkspaces = candidateWorkspaces.filter(workspace => {
        return workspace !== null;
      }) as Array<Workspace>;

      if (filteredWorkspaces.length === 1) {
        return await scriptUtils.executeWorkspaceScript(filteredWorkspaces[0], name, args, {stdin, stdout, stderr});
      }
    }

    throw new UsageError(`Couldn't find a script named "${name}"`);
  });
