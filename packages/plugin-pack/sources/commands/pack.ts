import {WorkspaceRequiredError}                                                 from '@berry/cli';
import {Configuration, MessageName, PluginConfiguration, Project, StreamReport} from '@berry/core';
import {xfs}                                                                    from '@berry/fslib';
import {posix}                                                                  from 'path';
import {Writable}                                                               from 'stream';

import * as packUtils                                                           from '../packUtils';

// eslint-disable-next-line arca/no-default-export
export default (clipanion: any, pluginConfiguration: PluginConfiguration) => clipanion

  .command(`pack [-n,--dry-run] [--json]`)
  .describe(`bundle local packages for publishing`)

  .detail(`
    This command will turn the local workspace into a compressed archive suitable for publishing.

    If the \`-n,--dry-run\` flag is set the command will just print the file paths without actually generating the package archive.

    If the \`--json\` flag is set the output will follow a JSON-stream output format instead of the regular user-readable one.
  `)

  .example(
    `Create an archive from the active workspace`,
    `yarn pack`,
  )

  .example(
    `List the files that would be made part of the workspace's archive`,
    `yarn pack --dry-run`,
  )

  .action(async ({cwd, stdout, dryRun, json}: {cwd: string, stdout: Writable, dryRun: boolean, json: boolean}) => {
    const configuration = await Configuration.find(cwd, pluginConfiguration);
    const {workspace} = await Project.find(configuration, cwd);

    if (!workspace)
      throw new WorkspaceRequiredError(cwd);

    const report = await StreamReport.start({configuration, stdout, json}, async report => {
      report.reportJson({base: workspace.cwd});

      const files = await packUtils.genPackList(workspace);

      for (const file of files) {
        report.reportInfo(MessageName.UNNAMED, file);
        report.reportJson({location: file});
      }

      if (!dryRun) {
        const pack = await packUtils.genPackStream(workspace, files);

        const target = posix.resolve(workspace.cwd, `package.tgz`);
        const write = xfs.createWriteStream(target);

        pack.pipe(write);

        await new Promise(resolve => {
          write.on(`finish`, resolve);
        });

        report.reportInfo(MessageName.UNNAMED, `Package archive generated in ${configuration.format(target, `magenta`)}`);
        report.reportJson({output: target});
      }
    });

    return report.exitCode();
  });
