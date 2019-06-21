import {WorkspaceRequiredError}                                                                        from '@berry/cli';
import {Cache, Configuration, PluginConfiguration, Project}                                            from '@berry/core';
import {LightReport}                                                                                   from '@berry/core';
import {scriptUtils, structUtils}                                                                      from '@berry/core';
import {NodeFS, xfs, PortablePath, ppath, Filename, toFilename}                                        from '@berry/fslib';
import {Readable, Writable}                                                                            from 'stream';
import tmp                                                                                             from 'tmp';

// eslint-disable-next-line arca/no-default-export
export default (clipanion: any, pluginConfiguration: PluginConfiguration) => clipanion

  .command(`dlx <command> [... args] [-p,--package NAME ...] [-q,--quiet]`)
  .describe(`run a package in a temporary environment`)
  .flags({proxyArguments: true})

  .detail(`
    This command will install a package within a temporary environment, and run its binary script if it contains any. The binary will run within the current cwd.

    By default Yarn will download the package named \`command\`, but this can be changed through the use of the \`-p,--package\` flag which will instruct Yarn to still run the same command but from a different package.

    Also by default Yarn will print the full install logs when installing the given package. This behavior can be disabled by using the \`-q,--quiet\` flag which will instruct Yarn to only report critical errors.

    Using \`yarn dlx\` as a replacement of \`yarn add\` isn't recommended, as it makes your project non-deterministic (Yarn doesn't keep track of the packages installed through \`dlx\` - neither their name, nor their version).
  `)

  .example(
    `Use create-react-app to create a new React app`,
    `yarn dlx create-react-app ./my-app`,
  )

  .action(async ({cwd, stdin, stdout, stderr, command, package: packages, args, quiet, ...rest}: {cwd: PortablePath, stdin: Readable, stdout: Writable, stderr: Writable, command: string, package: Array<string>, args: Array<string>, quiet: boolean}) => {
    const tmpDir = await createTemporaryDirectory(toFilename(`dlx-${process.pid}`));

    try {
      await xfs.writeFilePromise(ppath.join(tmpDir, toFilename(`package.json`)), `{}\n`);
      await xfs.writeFilePromise(ppath.join(tmpDir, toFilename(`yarn.lock`)), ``);
      await xfs.writeFilePromise(ppath.join(tmpDir, toFilename(`.yarnrc.yml`)), `enableGlobalCache: true\n`);

      if (packages.length === 0) {
        packages = [command];
        command = structUtils.parseDescriptor(command).name;
      }

      const addOptions = [];
      if (quiet)
        addOptions.push(`--quiet`);

      const addExitCode = await clipanion.run(null, [`add`, ...addOptions, `--`, ...packages], {cwd: tmpDir, stdin, stdout, stderr, ...rest});
      if (addExitCode !== 0)
        return addExitCode;

      if (!quiet)
        stdout.write(`\n`);

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
    } finally {
      await xfs.removePromise(tmpDir);
    }
  });

function createTemporaryDirectory(name?: Filename) {
  return new Promise<PortablePath>((resolve, reject) => {
    tmp.dir({unsafeCleanup: true}, (error, dirPath) => {
      if (error) {
        reject(error);
      } else {
        resolve(NodeFS.toPortablePath(dirPath));
      }
    });
  }).then(async dirPath => {
    dirPath = await xfs.realpathPromise(dirPath);

    if (name) {
      dirPath = ppath.join(dirPath, name);
      await xfs.mkdirpPromise(dirPath);
    }

    return dirPath;
  });
}
