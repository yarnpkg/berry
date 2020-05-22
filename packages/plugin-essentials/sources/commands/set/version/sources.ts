import {BaseCommand}                                                                            from '@yarnpkg/cli';
import {Configuration, MessageName, StreamReport, execUtils, CommandContext, Report, hashUtils} from '@yarnpkg/core';
import {Filename, PortablePath, npath, ppath, xfs}                                              from '@yarnpkg/fslib';
import {Command, Usage}                                                                         from 'clipanion';
import {tmpdir}                                                                                 from 'os';
import path                                                                                     from 'path';

import {setVersion}                                                                             from '../version';

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

const BUILD_WORKFLOW = ({plugins, noMinify}: {noMinify: boolean, plugins: Array<string>}, target: PortablePath) => [
  [`yarn`, `build:cli`, ...new Array<string>().concat(...plugins.map(plugin => [`--plugin`, path.resolve(target, plugin)])), ...noMinify ? [`--no-minify`] : [], `|`],
];

// eslint-disable-next-line arca/no-default-export
export default class SetVersionSourcesCommand extends BaseCommand {
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

    const target = typeof this.installPath !== `undefined`
      ? ppath.resolve(this.context.cwd, npath.toPortablePath(this.installPath))
      : ppath.resolve(npath.toPortablePath(tmpdir()), `yarnpkg-sources` as Filename, hashUtils.makeHash(this.repository).slice(0, 6) as Filename);

    const report = await StreamReport.start({
      configuration,
      stdout: this.context.stdout,
    }, async (report: StreamReport) => {
      await prepareRepo(this, {configuration, report, target});

      report.reportSeparator();
      report.reportInfo(MessageName.UNNAMED, `Building a fresh bundle`);
      report.reportSeparator();

      await runWorkflow(BUILD_WORKFLOW(this, target), {configuration, context: this.context, target});

      report.reportSeparator();

      const bundlePath = ppath.resolve(target, `packages/yarnpkg-cli/bundles/yarn.js` as PortablePath);
      const bundleBuffer = await xfs.readFilePromise(bundlePath);

      await setVersion(configuration, `sources`, bundleBuffer, {
        report,
      });
    });

    return report.exitCode();
  }
}

export async function runWorkflow(workflow: Array<Array<string>>, {configuration, context, target}: {configuration: Configuration, context: CommandContext, target: PortablePath}) {
  for (const [fileName, ...args] of workflow) {
    const usePipe = args[args.length - 1] === `|`;
    if (usePipe)
      args.pop();

    if (usePipe) {
      await execUtils.pipevp(fileName, args, {
        cwd: target,
        stdin: context.stdin,
        stdout: context.stdout,
        stderr: context.stderr,
        strict: true,
      });
    } else {
      context.stdout.write(`${configuration.format(`  $ ${[fileName, ...args].join(` `)}`, `grey`)}\n`);

      try {
        await execUtils.execvp(fileName, args, {
          cwd: target,
          strict: true,
        });
      } catch (error) {
        context.stdout.write(error.stdout || error.stack);
        throw error;
      }
    }
  }
}

export type PrepareSpec = {
  branch: string;
  context: CommandContext;
  force: boolean;
  repository: string;
};

export async function prepareRepo(spec: PrepareSpec, {configuration, report, target}: {configuration: Configuration, report: Report, target: PortablePath}) {
  let ready = false;

  if (!spec.force && xfs.existsSync(ppath.join(target, `.git` as Filename))) {
    report.reportInfo(MessageName.UNNAMED, `Fetching the latest commits`);
    report.reportSeparator();

    try {
      await runWorkflow(UPDATE_WORKFLOW(spec), {configuration, context: spec.context, target});
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

    await runWorkflow(CLONE_WORKFLOW(spec, target), {configuration, context: spec.context, target});
  }
}
