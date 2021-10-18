import {BaseCommand, WorkspaceRequiredError}                                                                        from '@yarnpkg/cli';
import {Cache, Configuration, MessageName, Project, StreamReport, Workspace, formatUtils, structUtils, ThrowReport} from '@yarnpkg/core';
import {Filename, npath, ppath, xfs}                                                                                from '@yarnpkg/fslib';
import {Command, Option, Usage}                                                                                     from 'clipanion';

import * as packUtils                                                                                               from '../packUtils';

// eslint-disable-next-line arca/no-default-export
export default class PackCommand extends BaseCommand {
  static paths = [
    [`pack`],
  ];

  static usage: Usage = Command.Usage({
    description: `generate a tarball from the active workspace`,
    details: `
      This command will turn the active workspace into a compressed archive suitable for publishing. The archive will by default be stored at the root of the workspace (\`package.tgz\`).

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
      `yarn pack --out /artifacts/%s-%v.tgz`,
    ]],
  });

  installIfNeeded = Option.Boolean(`--install-if-needed`, false, {
    description: `Run a preliminary \`yarn install\` if the package contains build scripts`,
  });

  dryRun = Option.Boolean(`-n,--dry-run`, false, {
    description: `Print the file paths without actually generating the package archive`,
  });

  json = Option.Boolean(`--json`, false, {
    description: `Format the output as an NDJSON stream`,
  });

  out = Option.String(`-o,--out`, {
    description: `Create the archive at the specified path`,
  });

  // Legacy option
  filename = Option.String(`--filename`, {hidden: true});

  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project, workspace} = await Project.find(configuration, this.context.cwd);

    if (!workspace)
      throw new WorkspaceRequiredError(project.cwd, this.context.cwd);

    if (await packUtils.hasPackScripts(workspace)) {
      if (this.installIfNeeded) {
        await project.install({
          cache: await Cache.find(configuration),
          report: new ThrowReport(),
        });
      } else {
        await project.restoreInstallState();
      }
    }

    const out = this.out ?? this.filename;

    const target = typeof out !== `undefined`
      ? ppath.resolve(this.context.cwd, interpolateOutputName(out, {workspace}))
      : ppath.resolve(workspace.cwd, `package.tgz` as Filename);

    const report = await StreamReport.start({
      configuration,
      stdout: this.context.stdout,
      json: this.json,
    }, async report => {
      await packUtils.prepareForPack(workspace, {report}, async () => {
        report.reportJson({base: npath.fromPortablePath(workspace.cwd)});

        const files = await packUtils.genPackList(workspace);

        for (const file of files) {
          report.reportInfo(null, npath.fromPortablePath(file));
          report.reportJson({location: npath.fromPortablePath(file)});
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
        report.reportInfo(MessageName.UNNAMED, `Package archive generated in ${formatUtils.pretty(configuration, target, formatUtils.Type.PATH)}`);
        report.reportJson({output: npath.fromPortablePath(target)});
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
