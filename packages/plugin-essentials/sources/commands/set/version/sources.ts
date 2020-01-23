import {BaseCommand}                                                  from '@yarnpkg/cli';
import {WorkspaceRequiredError}                                       from '@yarnpkg/cli';
import {Configuration, MessageName, Project, StreamReport, execUtils} from '@yarnpkg/core';
import {Filename, PortablePath, npath, ppath, xfs}                    from '@yarnpkg/fslib';
import {Command, Usage}                                               from 'clipanion';
import {tmpdir}                                                       from 'os';

import {setVersion}                                                   from '../version';

const PR_REGEXP = /^[0-9]+$/;

function getBranchRef(branch: string) {
  if (PR_REGEXP.test(branch)) {
    return `pull/${branch}/head`;
  } else {
    return branch;
  }
}

const CLONE_WORKFLOW = ({repository, branch}: {repository: string, branch: string}, target: PortablePath) => [
  [`git`, `init`, npath.fromPortablePath(target)],
  [`git`, `remote`, `add`, `origin`, repository],
  [`git`, `fetch`, `origin`, getBranchRef(branch)],
  [`git`, `reset`, `--hard`, `FETCH_HEAD`],
];

const UPDATE_WORKFLOW = ({branch}: {branch: string}) => [
  [`git`, `fetch`, `origin`, getBranchRef(branch), `--force`],
  [`git`, `reset`, `--hard`, `FETCH_HEAD`],
  [`git`, `clean`, `-dfx`],
];

const BUILD_WORKFLOW = ({plugins, noMinify}: {noMinify: boolean, plugins: Array<string>}) => [
  [`yarn`, `build:cli`, ...new Array<string>().concat(...plugins.map(plugin => [`--plugin`, plugin])), ...noMinify ? [`--no-minify`] : [], `|`],
];

// eslint-disable-next-line arca/no-default-export
export default class SetVersionCommand extends BaseCommand {
  @Command.String(`--path`)
  installPath?: string;

  @Command.String(`--repository`)
  repository: string = `https://github.com/yarnpkg/berry.git`;

  @Command.String(`--branch`)
  branch: string = `master`;

  @Command.Array(`--plugin`)
  plugins: Array<string> = [];

  @Command.Boolean(`--no-minify`)
  noMinify: boolean = false;

  @Command.Boolean(`-f,--force`)
  force: boolean = false;

  static usage: Usage = Command.Usage({
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
      throw new WorkspaceRequiredError(project.cwd, this.context.cwd);

    const target = typeof this.installPath !== `undefined`
      ? ppath.resolve(this.context.cwd, npath.toPortablePath(this.installPath))
      : ppath.resolve(npath.toPortablePath(tmpdir()), `yarnpkg-sources` as Filename);

    const report = await StreamReport.start({
      configuration,
      stdout: this.context.stdout,
    }, async (report: StreamReport) => {
      const runWorkflow = async (workflow: Array<Array<string>>) => {
        for (const [fileName, ...args] of workflow) {
          const usePipe = args[args.length - 1] === `|`;
          if (usePipe)
            args.pop();

          if (usePipe) {
            await execUtils.pipevp(fileName, args, {
              cwd: target,
              stdin: this.context.stdin,
              stdout: this.context.stdout,
              stderr: this.context.stderr,
              strict: true,
            });
          } else {
            this.context.stdout.write(`${configuration.format(`  $ ${[fileName, ...args].join(` `)}`, `grey`)}\n`);

            try {
              await execUtils.execvp(fileName, args, {
                cwd: target,
                strict: true,
              });
            } catch (error) {
              this.context.stdout.write(error.stdout || error.stack);
              throw error;
            }
          }
        }
      };

      let ready = false;

      if (!this.force && xfs.existsSync(ppath.join(target, `.git` as Filename))) {
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

      report.reportSeparator();
      report.reportInfo(MessageName.UNNAMED, `Building a fresh bundle`);
      report.reportSeparator();

      await runWorkflow(BUILD_WORKFLOW(this));

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
