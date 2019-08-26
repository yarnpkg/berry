import {BaseCommand}                                                          from '@yarnpkg/cli';
import {WorkspaceRequiredError}                                               from '@yarnpkg/cli';
import {Configuration, MessageName, Project, StreamReport, execUtils}         from '@yarnpkg/core';
import {Filename, PortablePath, ppath, toPortablePath, xfs, fromPortablePath} from '@yarnpkg/fslib';
import {Command}                                                              from 'clipanion';
import {tmpdir}                                                               from 'os';

import {setVersion}                                                           from '../version';

const CLONE_WORKFLOW = ({repository, branch}: {repository: string, branch: string}, target: PortablePath) => [
  [`git`, `clone`, repository, fromPortablePath(target)],
  [`git`, `config`, `advice.detachedHead`, `false`],
  [`git`, `checkout`, `origin/${branch}`],
];

const UPDATE_WORKFLOW = ({branch}: {branch: string}) => [
  [`git`, `fetch`, `origin`],
  [`git`, `reset`, `--hard`],
  [`git`, `clean`, `-dfx`],
  [`git`, `checkout`, `origin/${branch}`],
  [`git`, `clean`, `-dfx`],
];

const BUILD_WORKFLOW = [
  [`yarn`, `build:cli`],
];

// eslint-disable-next-line arca/no-default-export
export default class SetVersionCommand extends BaseCommand {
  @Command.String(`--path`)
  installPath?: string;

  @Command.String(`--repository`)
  repository: string = `git@github.com:yarnpkg/berry`;

  @Command.String(`--branch`)
  branch: string = `master`;

  static usage = Command.Usage({
    description: `build Yarn from master`,
    details: `
      This command will clone the Yarn repository into a temporary folder, then build it. The resulting bundle will then be copied into the local project.
    `,
    examples: [[
      `Build Yarn from master`,
      `yarn set version from sources`,
    ]],
  });

  @Command.Path(`set`, `version`, `from`, `sources`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project, workspace} = await Project.find(configuration, this.context.cwd);

    if (!workspace)
      throw new WorkspaceRequiredError(this.context.cwd);

    const target = typeof this.installPath !== `undefined`
      ? ppath.resolve(this.context.cwd, toPortablePath(this.installPath))
      : ppath.resolve(toPortablePath(tmpdir()), `yarnpkg-sources` as Filename);

    const report = await StreamReport.start({
      configuration,
      stdout: this.context.stdout,
    }, async (report: StreamReport) => {
      let workflow;
      if (xfs.existsSync(ppath.join(target, `.git` as Filename))) {
        report.reportInfo(MessageName.UNNAMED, `Fetching the latest commits`);
        workflow = UPDATE_WORKFLOW(this);
      } else {
        report.reportInfo(MessageName.UNNAMED, `Cloning the remote repository`);
        workflow = CLONE_WORKFLOW(this, target);

        await xfs.removePromise(target);
        await xfs.mkdirpPromise(target);
      }

      report.reportSeparator();

      for (const [fileName, ...args] of workflow) {
        await execUtils.pipevp(fileName, args, {
          cwd: target,
          stdin: this.context.stdin,
          stdout: this.context.stdout,
          stderr: this.context.stderr,
          strict: true,
        });
      }

      report.reportSeparator();
      report.reportInfo(MessageName.UNNAMED, `Building a fresh bundle`);
      report.reportSeparator();

      for (const [fileName, ...args] of BUILD_WORKFLOW) {
        await execUtils.pipevp(fileName, args, {
          cwd: target,
          stdin: this.context.stdin,
          stdout: this.context.stdout,
          stderr: this.context.stderr,
          strict: true,
        });
      }

      report.reportSeparator();

      const bundlePath = ppath.resolve(target, `packages/yarnpkg-cli/bundles/yarn.js` as PortablePath);
      const bundleBuffer = await xfs.readFilePromise(bundlePath);

      await setVersion(project, `yarn-sources`, bundleBuffer, {
        report,
      });
    });

    return report.exitCode();
  }
}
