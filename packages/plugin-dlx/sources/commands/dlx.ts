import {Cache, Configuration, PluginConfiguration, Project} from '@berry/core';
import {LightReport}                                        from '@berry/core';
import {scriptUtils, structUtils}                           from '@berry/core';
import {xfs}                                                from '@berry/fslib';
import {UsageError}                                         from '@manaflair/concierge';
import {posix}                                              from 'path';
import {Readable, Writable}                                 from 'stream';
import tmp                                                  from 'tmp';

export default (concierge: any, pluginConfiguration: PluginConfiguration) => concierge

  .command(`dlx <command> [... args] [-p,--package NAME]`)
  .describe(`run a package in a temporary environment`)

  .detail(`
    This command will install a package within a temporary environment, and run its binary script if it contains any. The binary will run within the current cwd.

    Using \`yarn dlx\` as a replacement of \`yarn add\` isn't recommended, as it makes your project non-deterministic (since Yarn doesn't register that your project depends on packages installed via \`dlx\`).
  `)

  .example(
    `Use create-react-native to create a new React app`,
    `yarn dlx create-react-app ./my-app`,
  )

  .action(async ({cwd, stdin, stdout, stderr, command, package: pkg, args, ... rest}: {cwd: string, stdin: Readable, stdout: Writable, stderr: Writable, command: string, package: string | undefined, args: Array<string>}) => {
    const tmpDir = await createTemporaryDirectory(`dlx-${process.pid}`);
    await xfs.writeFilePromise(`${tmpDir}/package.json`, `{}\n`);
    await xfs.writeFilePromise(`${tmpDir}/.yarnrc`, `enable-global-cache true\n`);

    if (!pkg) {
      pkg = command;
      command = structUtils.parseDescriptor(pkg).name;
    }

    // We could reimplement `add` in `dlx`, but at least for now it makes more
    // sense to simply defer to the implementation provided by the `essentials`
    // plugin, since we get to inherit all its features for free.
    const addExitCode = await concierge.run(null, [`add`, pkg], {cwd: tmpDir, stdin, stdout, stderr, pkg, ... rest});
    if (addExitCode !== 0)
      return addExitCode;

    const configuration = await Configuration.find(tmpDir, pluginConfiguration);
    const {project, workspace} = await Project.find(configuration, tmpDir);
    const cache = await Cache.find(configuration);

    if (workspace === null)
      throw new Error(`Assertion failed: The command should have been running within a workspace`);
    if (workspace !== project.topLevelWorkspace)
      throw new Error(`Assertion failed: The command should have been running within the top-level workspace`);

    const report = await LightReport.start({configuration, stdout}, async (report: LightReport) => {
      await project.resolveEverything({lockfileOnly: true, cache, report});
    });

    if (report.hasErrors())
      return report.exitCode();

    return await scriptUtils.executeWorkspaceAccessibleBinary(workspace, command, args, {cwd, stdin, stdout, stderr});
  });

function createTemporaryDirectory(name?: string) {
  return new Promise<string>((resolve, reject) => {
    tmp.dir({unsafeCleanup: true}, (error, dirPath) => {
      if (error) {
        reject(error);
      } else {
        resolve(dirPath);
      }
    });
  }).then(async dirPath => {
    dirPath = await xfs.realpathPromise(dirPath);

    if (name) {
      dirPath = posix.join(dirPath, name);
      await xfs.mkdirpPromise(dirPath);
    }
    
    return dirPath;
  });
}