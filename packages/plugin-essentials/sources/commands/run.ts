import {Configuration, PluginConfiguration, Project, Workspace, Cache} from '@berry/core';
import {LightReport}                                                   from '@berry/core';
import {scriptUtils, structUtils}                                      from '@berry/core';
import {UsageError}                                                    from 'clipanion';
import {Readable, Writable}                                            from 'stream';

// eslint-disable-next-line arca/no-default-export
export default (clipanion: any, pluginConfiguration: PluginConfiguration) => clipanion

  .command(`run <name> [... args] [-T,--top-level]`)
  .describe(`run a script defined in the package.json`)
  .flags({proxyArguments: true})

  .detail(`
    This command will run a tool. The exact tool that will be executed will depend on the current state of your workspace:

    - If the \`scripts\` field from your local package.json contains a matching script name, its definition will get executed.

    - Otherwise, if one of the local workspace's dependencies exposes a binary with a matching name, this binary will get executed.

    - Otherwise, if the specified name contains a colon character and if one of the workspaces in the project contains exactly one script with a matching name, then this script will get executed.

    Whatever happens, the cwd of the spawned process will be the workspace that declares the script (which makes it possible to call commands cross-workspaces using the third syntax).
  `)

  .action(async ({cwd, stdin, stdout, stderr, name, topLevel, args}: {cwd: string, stdin: Readable, stdout: Writable, stderr: Writable, name: string, topLevel: boolean, args: Array<string>}) => {
    const configuration = await Configuration.find(cwd, pluginConfiguration);
    const {project, workspace, locator} = await Project.find(configuration, cwd);
    const cache = await Cache.find(configuration);

    const report = await LightReport.start({configuration, stdout}, async (report: LightReport) => {
      await project.resolveEverything({lockfileOnly: true, cache, report});
    });

    const effectiveLocator = topLevel
      ? project.topLevelWorkspace.anchoredLocator
      : locator;

    if (report.hasErrors())
      return report.exitCode();

    // First we check to see whether a script exist inside the current package
    // for the given name

    if (await scriptUtils.hasPackageScript(effectiveLocator, name, {project}))
      return await scriptUtils.executePackageScript(effectiveLocator, name, args, {project, stdin, stdout, stderr});

    // If we can't find it, we then check whether one of the dependencies of the
    // current package exports a binary with the requested name

    const binaries = await scriptUtils.getPackageAccessibleBinaries(effectiveLocator, {project});
    const binary = binaries.get(name);

    if (binary)
      return await scriptUtils.executePackageAccessibleBinary(effectiveLocator, name, args, {cwd, project, stdin, stdout, stderr});

    // When it fails, we try to check whether it's a global script (ie we look
    // into all the workspaces to find one that exports this script). We only do
    // this if the script name contains a colon character (":"), and we skip
    // this logic if multiple workspaces share the same script name.
    // 
    // We also disable this logic for packages coming from third-parties (ie
    // not workspaces). Not particular reason except maybe security concerns.

    if (!topLevel && workspace && name.includes(`:`)) {
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

    if (topLevel) {
      if (name === `node-gyp`) {
        throw new UsageError(`Couldn't find a script name "${name}" in the top-level (used by ${structUtils.prettyLocator(configuration, locator)}). This typically happens because some package depends on "node-gyp" to build itself, but didn't list it in their dependencies. To fix that, please run "yarn add node-gyp" into your top-level workspace. You also can open an issue on the repository of the specified package to suggest them to use an optional peer dependency.`);
      } else {
        throw new UsageError(`Couldn't find a script name "${name}" in the top-level (used by ${structUtils.prettyLocator(configuration, locator)}).`);
      }
    } else {
      throw new UsageError(`Couldn't find a script named "${name}".`);
    }
  });
