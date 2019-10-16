import {BaseCommand, WorkspaceRequiredError}                                       from '@yarnpkg/cli';
import {Configuration, MessageName, Project, StreamReport, Workspace, structUtils} from '@yarnpkg/core';
import {Filename, npath, ppath, xfs}                                               from '@yarnpkg/fslib';
import {Command}                                                                   from 'clipanion';

import * as packUtils                                                              from '../packUtils';

// eslint-disable-next-line arca/no-default-export
export default class PackCommand extends BaseCommand {
  @Command.Boolean(`-n,--dry-run`)
  dryRun: boolean = false;

  @Command.Boolean(`--json`)
  json: boolean = false;

  @Command.String(`--filename`, {hidden: false})
  @Command.String(`-o,--out`)
  out?: string;

  static usage = Command.Usage({
    description: `generate a tarball from the active workspace`,
    details: `
      This command will turn the active workspace into a compressed archive suitable for publishing. The archive will by default be stored at the root of the workspace (\`package.tgz\`).

      If the \`-n,--dry-run\` flag is set the command will just print the file paths without actually generating the package archive.

      If the \`--json\` flag is set the output will follow a JSON-stream output also known as NDJSON (https://github.com/ndjson/ndjson-spec).

      If the \`-o,---out\` is set the archive will be created at the specified path. The \`%s\` and \`%v\` variables can be used within the path and will be respectively replaced by the package name and version.
    `,
    examples: [[
      `Create an archive from the active workspace`,
      `yarn pack`,
    ], [
      `List the files that would be made part of the workspace's archive`,
      `yarn pack --dry-run`,
    ], [
      `Name and output the archive in a dedicated folder`,
      `yarn pack /artifacts/%s-%v.tgz`,
    ]],
  });

  @Command.Path(`pack`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {workspace} = await Project.find(configuration, this.context.cwd);

    if (!workspace)
      throw new WorkspaceRequiredError(this.context.cwd);

    const target = typeof this.out !== `undefined`
      ? ppath.resolve(this.context.cwd, interpolateOutputName(this.out, {workspace}))
      : ppath.resolve(workspace.cwd, `package.tgz` as Filename);

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

function interpolateOutputName(name: string, {workspace}: {workspace: Workspace}) {
  const interpolated = name
    .replace(`%s`, prettyWorkspaceIdent(workspace))
    .replace(`%v`, prettyWorkspaceVersion(workspace));

  return npath.toPortablePath(interpolated);
}

function prettyWorkspaceIdent(workspace: Workspace) {
  if (workspace.manifest.name !== null) {
    return structUtils.slugifyIdent(workspace.manifest.name);
  } else {
    return `package`;
  }
}

function prettyWorkspaceVersion(workspace: Workspace) {
  if (workspace.manifest.version !== null) {
    return workspace.manifest.version;
  } else {
    return `unknown`;
  }
}
