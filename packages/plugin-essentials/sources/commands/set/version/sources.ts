import {BaseCommand}                                                          from '@yarnpkg/cli';
import {WorkspaceRequiredError}                                               from '@yarnpkg/cli';
import {Configuration, MessageName, Project, StreamReport, execUtils}         from '@yarnpkg/core';
import {Filename, PortablePath, ppath, toPortablePath, xfs, fromPortablePath} from '@yarnpkg/fslib';
import {Command}                                                              from 'clipanion';
import {tmpdir}                                                               from 'os';

import {setVersion}                                                           from '../version';

const CLONE_WORKFLOW = ({repository, branch, prs}: {repository: string, branch: string, prs: Array<string>}, target: PortablePath) => [
  [`git`, `clone`, repository, fromPortablePath(target), ...prs.length > 0 ? [] : [`--depth`, `1`]],
  [`git`, `checkout`, `origin/${branch}`],
];

const UPDATE_WORKFLOW = ({branch, prs}: {branch: string, prs: Array<string>}) => [
  [`git`, `fetch`, `origin`, branch, ...prs.length > 0 ? [`--depth`, `1`] : []],
  [`git`, `reset`, `--hard`],
  [`git`, `clean`, `-dfx`],
  [`git`, `checkout`, `origin/${branch}`],
  [`git`, `clean`, `-dfx`],
];

const PR_WORKFLOW = ({branch}: {branch: string}, pr: string) => [
  [`git`, `fetch`, `--force`, `origin`, `pull/${pr}/head:pr-${pr}`],
  [`git`, `checkout`, `pr-${pr}`],
  [`git`, `checkout`, `--detach`],
  [`git`, `reset`, `origin/${branch}`, `--`, `**/package.json`],
  [`git`, `reset`, `origin/${branch}`, `--`, `packages/*/bin/**/*`],
  [`git`, `commit`, `--allow-empty`, `-m`, `Cleaning the repository`],
  [`git`, `checkout`, `origin/${branch}`],
  [`git`, `merge`, `--no-edit`, `-`],
];

const BUILD_WORKFLOW = [
  [`yarn`, `build:cli`],
];

// eslint-disable-next-line arca/no-default-export
export default class SetVersionCommand extends BaseCommand {
  @Command.String(`--path`)
  installPath?: string;

  @Command.String(`--repository`)
  repository: string = `https://github.com/yarnpkg/berry.git`;

  @Command.String(`--branch`)
  branch: string = `master`;

  @Command.Array(`--pr`)
  prs: Array<string> = [];

  @Command.Boolean(`-f,--force`)
  force: boolean = false;

  static usage = Command.Usage({
    description: `build Yarn from master`,
    details: `
      This command will clone the Yarn repository into a temporary folder, then build it. The resulting bundle will then be copied into the local project.
    `,
    examples: [[
      `Build Yarn from master`,
      `$0 set version from sources`,
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
      const runWorkflow = async (workflow: Array<Array<string>>) => {
        for (const [fileName, ...args] of workflow) {
          this.context.stdout.write(`${configuration.format(`  $ ${[fileName, ...args].join(` `)}`, `grey`)}\n`);

          try {
            await execUtils.execvp(fileName, args, {cwd: target, strict: true});
          } catch (error) {
            this.context.stdout.write(error.stdout);
            throw error;
          }
        }
      };

      let ready = false;

      if (!this.force && xfs.existsSync(ppath.join(target, `.git` as Filename)) && (this.prs.length === 0 || !xfs.existsSync(ppath.join(target, `.git/shallow` as PortablePath)))) {
        report.reportInfo(MessageName.UNNAMED, `Fetching the latest commits`);
        report.reportSeparator();

        try {
          await runWorkflow(UPDATE_WORKFLOW(this));
          ready = true;
        } catch (error) {
          report.reportSeparator();
          report.reportWarning(MessageName.UNNAMED, `Repository update failed; we'll try to regenerate it`);
        }
      }

      if (!ready) {
        report.reportInfo(MessageName.UNNAMED, `Cloning the remote repository`);
        report.reportSeparator();

        await xfs.removePromise(target);
        await xfs.mkdirpPromise(target);

        await runWorkflow(CLONE_WORKFLOW(this, target));
      }

      for (const pr of this.prs) {
        report.reportSeparator();
        report.reportInfo(MessageName.UNNAMED, `Merging https://github.com/yarnpkg/berry/pull/${pr}`);
        report.reportSeparator();

        await runWorkflow(PR_WORKFLOW(this, pr));
      }

      report.reportSeparator();
      report.reportInfo(MessageName.UNNAMED, `Building a fresh bundle`);
      report.reportSeparator();

      await runWorkflow(BUILD_WORKFLOW);

      report.reportSeparator();

      const bundlePath = ppath.resolve(target, `packages/yarnpkg-cli/bundles/yarn.js` as PortablePath);
      const bundleBuffer = await xfs.readFilePromise(bundlePath);

      await setVersion(project, `sources`, bundleBuffer, {
        report,
      });
    });

    return report.exitCode();
  }
}
