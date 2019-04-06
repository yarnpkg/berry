import {WorkspaceRequiredError}                             from '@berry/cli';
import {Cache, Configuration, PluginConfiguration, Project} from '@berry/core';
import {LightReport}                                        from '@berry/core';
import {scriptUtils, structUtils}                           from '@berry/core';
import {xfs}                                                from '@berry/fslib';
import {suggestUtils}                                       from '@berry/plugin-essentials';
import {UsageError}                                         from 'clipanion';
import {posix}                                              from 'path';
import {Readable, Writable}                                 from 'stream';
import tmp                                                  from 'tmp';

// eslint-disable-next-line arca/no-default-export
export default (clipanion: any, pluginConfiguration: PluginConfiguration) => clipanion

  .command(`dlx <command> [... args] [-p,--package NAME ...] [-q,--quiet]`)
  .describe(`run a package in a temporary environment`)
  .flags({proxyArguments: true})

  .detail(`
    This command will install a package within a temporary environment, and run its binary script if it contains any. The binary will run within the current cwd.

    By default Yarn will print the full logs for the given package install process. This behavior can be silenced by using the \`-q,--quiet\` flag which will instruct Yarn to only report critical errors.

    Using \`yarn dlx\` as a replacement of \`yarn add\` isn't recommended, as it makes your project non-deterministic (since Yarn doesn't register that your project depends on packages installed via \`dlx\`).
  `)

  .example(
    `Use create-react-app to create a new React app`,
    `yarn dlx create-react-app ./my-app`,
  )

  .action(async ({cwd, stdin, stdout, stderr, command, package: packages, args, quiet, ... rest}: {cwd: string, stdin: Readable, stdout: Writable, stderr: Writable, command: string, package: Array<string>, args: Array<string>, quiet: boolean}) => {
    const tmpDir = await createTemporaryDirectory(`dlx-${process.pid}`);
    await xfs.writeFilePromise(`${tmpDir}/package.json`, `{}\n`);
    await xfs.writeFilePromise(`${tmpDir}/.yarnrc`, `enable-global-cache true\n`);

    if (packages.length === 0) {
      packages = [command];
      command = structUtils.parseDescriptor(command).name;
    }

    const addOptions = [];
    if (quiet)
      addOptions.push(`--quiet`);

    const addExitCode = await clipanion.run(null, [`add`, ... addOptions, `--`, ... packages], {cwd: tmpDir, stdin, stdout, stderr, ... rest});
    if (addExitCode !== 0)
      return addExitCode;

    const configuration = await Configuration.find(tmpDir, pluginConfiguration);
    const {project, workspace} = await Project.find(configuration, tmpDir);
    const cache = await Cache.find(configuration);

    if (workspace === null)
      throw new WorkspaceRequiredError(cwd);

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
