import {WorkspaceRequiredError}                                                      from '@berry/cli';
import {Configuration, PluginConfiguration, Project, Workspace, Cache, StreamReport} from '@berry/core';
import {LightReport}                                                                 from '@berry/core';
import {scriptUtils, structUtils}                                                    from '@berry/core';
import {miscUtils}                                                                   from '@berry/core';
import {PortablePath}                                                                from '@berry/fslib';
import {UsageError}                                                                  from 'clipanion';
import {Readable, Writable}                                                          from 'stream';
import {inspect}                                                                     from 'util';

// eslint-disable-next-line arca/no-default-export
export default (clipanion: any, pluginConfiguration: PluginConfiguration) => clipanion

  .command(`run [... args] [-T,--top-level]`)
  .describe(`run a script defined in the package.json`)
  .flags({proxyArguments: true})

  .detail(`
    This command will run a tool. The exact tool that will be executed will depend on the current state of your workspace:

    - If the \`scripts\` field from your local package.json contains a matching script name, its definition will get executed.

    - Otherwise, if one of the local workspace's dependencies exposes a binary with a matching name, this binary will get executed.

    - Otherwise, if the specified name contains a colon character and if one of the workspaces in the project contains exactly one script with a matching name, then this script will get executed.

    Whatever happens, the cwd of the spawned process will be the workspace that declares the script (which makes it possible to call commands cross-workspaces using the third syntax).
  `)

  .example(
    `Run the tests from the local workspace`,
    `yarn run test`,
  )

  .example(
    `Same thing, but without the "run" keyword`,
    `yarn test`,
  )

  .action(async ({cwd, stdin, stdout, stderr, topLevel, args}: {cwd: PortablePath, stdin: Readable, stdout: Writable, stderr: Writable, topLevel: boolean, args: Array<string>}) => {
    // Print the list of available scripts if the command is executed without the parameters
    if (args.length === 0)
      return printRunListing(cwd, pluginConfiguration, stdout)

    const [name, ...rest] = args;
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
      return await scriptUtils.executePackageScript(effectiveLocator, name, rest, {project, stdin, stdout, stderr});

    // If we can't find it, we then check whether one of the dependencies of the
    // current package exports a binary with the requested name

    const binaries = await scriptUtils.getPackageAccessibleBinaries(effectiveLocator, {project});
    const binary = binaries.get(name);

    if (binary)
      return await scriptUtils.executePackageAccessibleBinary(effectiveLocator, name, rest, {cwd, project, stdin, stdout, stderr});

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
        return await scriptUtils.executeWorkspaceScript(filteredWorkspaces[0], name, rest, {stdin, stdout, stderr});
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

async function printRunListing(cwd: PortablePath, pluginConfiguration: PluginConfiguration, stdout: Writable) {
  const configuration = await Configuration.find(cwd, pluginConfiguration);
  const {workspace} = await Project.find(configuration, cwd);

  if (!workspace)
    throw new WorkspaceRequiredError(cwd);

  const report = await StreamReport.start({configuration, stdout}, async report => {
    const scripts = workspace!.manifest.scripts
    const keys = miscUtils.sortMap(scripts.keys(), key => key);
    const inspectConfig = {
      breakLength: Infinity,
      colors: configuration.get(`enableColors`),
      maxArrayLength: 2,
    };

    const maxKeyLength = keys.reduce((max, key) => Math.max(max, key.length), 0);
    scripts.forEach((value: string, key: string) => {
      report.reportInfo(null, `${key.padEnd(maxKeyLength, ` `)}   ${inspect(value, inspectConfig)}`);
    });
  });
  return report.exitCode();
}
