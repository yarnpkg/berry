import {BaseCommand, WorkspaceRequiredError}               from '@berry/cli';
import {Configuration, MessageName, Project, StreamReport} from '@berry/core';
import {xfs, ppath, toFilename}                            from '@berry/fslib';
import {Command}                                           from 'clipanion';

import * as packUtils                                      from '../packUtils';

// eslint-disable-next-line arca/no-default-export
export default class PackCommand extends BaseCommand {
  @Command.Boolean(`-n,--dry-run`)
  dryRun: boolean = false;

  @Command.Boolean(`--json`)
  json: boolean = false;

  static usage = Command.Usage({
    description: `generate a tarball from the active workspace`,
    details: `
      This command will turn the active workspace into a compressed archive suitable for publishing.

      If the \`-n,--dry-run\` flag is set the command will just print the file paths without actually generating the package archive.

      If the \`--json\` flag is set the output will follow a JSON-stream output also known as NDJSON (https://github.com/ndjson/ndjson-spec).
    `,
    examples: [[
      `Create an archive from the active workspace`,
      `yarn pack`,
    ], [
      `List the files that would be made part of the workspace's archive`,
      `yarn pack --dry-run`,
    ]],
  });

  @Command.Path(`pack`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {workspace} = await Project.find(configuration, this.context.cwd);

    if (!workspace)
      throw new WorkspaceRequiredError(this.context.cwd);

    const target = ppath.resolve(workspace.cwd, toFilename(`package.tgz`));

    const report = await StreamReport.start({
      configuration,
      stdout: this.context.stdout,
      json: this.json,
    }, async report => {
      await packUtils.prepareForPack(workspace, {report}, async () => {
        report.reportJson({base: workspace.cwd});

        const files = await packUtils.genPackList(workspace);

        for (const file of files) {
          report.reportInfo(null, file);
          report.reportJson({location: file});
        }

        if (!this.dryRun) {
          const pack = await packUtils.genPackStream(workspace, files);
          const write = xfs.createWriteStream(target);

          pack.pipe(write);

          await new Promise(resolve => {
            write.on(`finish`, resolve);
          });
        }
      });

      if (!this.dryRun) {
        report.reportInfo(MessageName.UNNAMED, `Package archive generated in ${configuration.format(target, `magenta`)}`);
        report.reportJson({output: target});
      }
    });

    return report.exitCode();
  }
}
