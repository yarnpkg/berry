import {BaseCommand}                                                                                                  from '@yarnpkg/cli';
import {Configuration, MessageName, StreamReport, execUtils, formatUtils, CommandContext, Report, hashUtils, Project} from '@yarnpkg/core';
import {Filename, PortablePath, npath, ppath, xfs}                                                                    from '@yarnpkg/fslib';
import {Command, Option, Usage}                                                                                       from 'clipanion';
import {tmpdir}                                                                                                       from 'os';

import {buildAndSavePlugin, BuildAndSavePluginsSpec}                                                                  from '../../plugin/import/sources';
import {getAvailablePlugins}                                                                                          from '../../plugin/list';
import {setVersion}                                                                                                   from '../version';

const PR_REGEXP = /^[0-9]+$/;
const IS_WIN32 = process.platform === `win32`;

function getBranchRef(branch: string) {
  if (PR_REGEXP.test(branch)) {
    return `pull/${branch}/head`;
  } else {
    return branch;
  }
}

const cloneWorkflow = ({repository, branch}: {repository: string, branch: string}, target: PortablePath) => [
  [`git`, `init`, npath.fromPortablePath(target)],
  [`git`, `remote`, `add`, `origin`, repository],
  [`git`, `fetch`, `origin`, `--depth=1`, getBranchRef(branch)],
  [`git`, `reset`, `--hard`, `FETCH_HEAD`],
];

const updateWorkflow = ({branch}: {branch: string}) => [
  [`git`, `fetch`, `origin`, `--depth=1`, getBranchRef(branch), `--force`],
  [`git`, `reset`, `--hard`, `FETCH_HEAD`],
  [`git`, `clean`, `-dfx`, `-e`, `packages/yarnpkg-cli/bundles`],
];

const buildWorkflow = ({plugins, noMinify}: {noMinify: boolean, plugins: Array<string>}, output: PortablePath, target: PortablePath) => [
  [`yarn`, `build:cli`, ...new Array<string>().concat(...plugins.map(plugin => [`--plugin`, ppath.resolve(target, plugin as Filename)])), ...noMinify ? [`--no-minify`] : [], `|`],
  [IS_WIN32 ? `move` : `mv`, `packages/yarnpkg-cli/bundles/yarn.js`, npath.fromPortablePath(output), `|`],
];

// eslint-disable-next-line arca/no-default-export
export default class SetVersionSourcesCommand extends BaseCommand {
  static paths = [
    [`set`, `version`, `from`, `sources`],
  ];

  static usage: Usage = Command.Usage({
    description: `build Yarn from master`,
    details: `
      This command will clone the Yarn repository into a temporary folder, then build it. The resulting bundle will then be copied into the local project.

      By default, it also updates all contrib plugins to the same commit the bundle is built from. This behavior can be disabled by using the \`--skip-plugins\` flag.
    `,
    examples: [[
      `Build Yarn from master`,
      `$0 set version from sources`,
    ]],
  });

  installPath = Option.String(`--path`, {
    description: `The path where the repository should be cloned to`,
  });

  repository = Option.String(`--repository`, `https://github.com/yarnpkg/berry.git`, {
    description: `The repository that should be cloned`,
  });

  branch = Option.String(`--branch`, `master`, {
    description: `The branch of the repository that should be cloned`,
  });

  plugins = Option.Array(`--plugin`, [], {
    description: `An array of additional plugins that should be included in the bundle`,
  });

  dryRun = Option.Boolean(`-n,--dry-run`, false, {
    description: `If set, the bundle will be built but not added to the project`,
  });

  noMinify = Option.Boolean(`--no-minify`, false, {
    description: `Build a bundle for development (debugging) - non-minified and non-mangled`,
  });

  force = Option.Boolean(`-f,--force`, false, {
    description: `Always clone the repository instead of trying to fetch the latest commits`,
  });

  skipPlugins = Option.Boolean(`--skip-plugins`, false, {
    description: `Skip updating the contrib plugins`,
  });

  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project} = await Project.find(configuration, this.context.cwd);

    const target = typeof this.installPath !== `undefined`
      ? ppath.resolve(this.context.cwd, npath.toPortablePath(this.installPath))
      : ppath.resolve(npath.toPortablePath(tmpdir()), `yarnpkg-sources`, hashUtils.makeHash(this.repository).slice(0, 6) as Filename);

    const report = await StreamReport.start({
      configuration,
      stdout: this.context.stdout,
    }, async (report: StreamReport) => {
      await prepareRepo(this, {configuration, report, target});

      report.reportSeparator();
      report.reportInfo(MessageName.UNNAMED, `Building a fresh bundle`);
      report.reportSeparator();

      const commitHash = await execUtils.execvp(`git`, [`rev-parse`, `--short`, `HEAD`], {cwd: target, strict: true});
      const bundlePath = ppath.join(target, `packages/yarnpkg-cli/bundles/yarn-${commitHash.stdout.trim()}.js`);

      if (!xfs.existsSync(bundlePath)) {
        await runWorkflow(buildWorkflow(this, bundlePath, target), {configuration, context: this.context, target});
        report.reportSeparator();
      }

      const bundleBuffer = await xfs.readFilePromise(bundlePath);

      if (!this.dryRun) {
        const {bundleVersion} = await setVersion(configuration, null, async () => bundleBuffer, {
          report,
        });

        if (!this.skipPlugins) {
          await updatePlugins(this, bundleVersion, {project, report, target});
        }
      }
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
      context.stdout.write(`${formatUtils.pretty(configuration, `  $ ${[fileName, ...args].join(` `)}`, `grey`)}\n`);

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

  if (!spec.force && xfs.existsSync(ppath.join(target, `.git`))) {
    report.reportInfo(MessageName.UNNAMED, `Fetching the latest commits`);
    report.reportSeparator();

    try {
      await runWorkflow(updateWorkflow(spec), {configuration, context: spec.context, target});
      ready = true;
    } catch {
      report.reportSeparator();
      report.reportWarning(MessageName.UNNAMED, `Repository update failed; we'll try to regenerate it`);
    }
  }

  if (!ready) {
    report.reportInfo(MessageName.UNNAMED, `Cloning the remote repository`);
    report.reportSeparator();

    await xfs.removePromise(target);
    await xfs.mkdirPromise(target, {recursive: true});

    await runWorkflow(cloneWorkflow(spec, target), {configuration, context: spec.context, target});
  }
}

async function updatePlugins(context: BuildAndSavePluginsSpec, version: string, {project, report, target}: {project: Project, report: Report, target: PortablePath}) {
  const data = await getAvailablePlugins(project.configuration, version);
  const contribPlugins = new Set(Object.keys(data));

  for (const name of project.configuration.plugins.keys()) {
    if (!contribPlugins.has(name))
      continue;

    await buildAndSavePlugin(name, context, {project, report, target});
  }
}
