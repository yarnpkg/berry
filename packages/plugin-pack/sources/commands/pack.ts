import {WorkspaceRequiredError}                                                 from '@berry/cli';
import {Configuration, MessageName, PluginConfiguration, Project, StreamReport} from '@berry/core';
import {xfs}                                                                    from '@berry/fslib';
import {posix}                                                                  from 'path';
import {Writable}                                                               from 'stream';

import * as packUtils                                                           from '../packUtils';

// eslint-disable-next-line arca/no-default-export
export default (clipanion: any, pluginConfiguration: PluginConfiguration) => clipanion

  .command(`pack [--list]`)
  .describe(`bundle local packages for publishing`)

  .detail(`
    This command will turn the local workspace into a compressed archive suitable for publishing.

    Adding the \`--list\` parameter will cause the command to simply print the path of the files that would be included within the archive before exiting. No archive will be emitted.
  `)

  .example(
    `Create an archive from the active workspace`,
    `yarn pack`,
  )

  .example(
    `List the files that would be made part of the workspace's archive`,
    `yarn pack --list`,
  )

  .action(async ({cwd, stdout, list}: {cwd: string, stdout: Writable, list: boolean}) => {
    const configuration = await Configuration.find(cwd, pluginConfiguration);
    const {workspace} = await Project.find(configuration, cwd);

    if (!workspace)
      throw new WorkspaceRequiredError(cwd);

    const report = await StreamReport.start({configuration, stdout}, async report => {
      const files = await packUtils.genPackList(workspace);

      for (const file of files)
        report.reportInfo(MessageName.UNNAMED, file);

      if (list) {
        const pack = await packUtils.genPackStream(workspace, files);

        const target = posix.resolve(workspace.cwd, `package.tgz`);
        pack.pipe(xfs.createWriteStream(target));
      }
    });

    return report.exitCode();
  });
