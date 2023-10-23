import {BaseCommand, WorkspaceRequiredError}                         from '@yarnpkg/cli';
import {Configuration, LocatorHash, Project, scriptUtils, Workspace} from '@yarnpkg/core';
import {DescriptorHash, MessageName, Report, StreamReport}           from '@yarnpkg/core';
import {formatUtils, miscUtils, structUtils, nodeUtils}              from '@yarnpkg/core';
import {gitUtils}                                                    from '@yarnpkg/plugin-git';
import {Command, Option, Usage, UsageError}                          from 'clipanion';
import micromatch                                                    from 'micromatch';
import pLimit                                                        from 'p-limit';
import {Writable}                                                    from 'stream';
import {WriteStream}                                                 from 'tty';
import * as t                                                        from 'typanion';

// eslint-disable-next-line arca/no-default-export
export default class WorkspacesForeachCommand extends BaseCommand {
  static paths = [
    [`workspaces`, `foreach`],
  ];

  static usage: Usage = Command.Usage({
    category: `Workspace-related commands`,
    description: `run a command on all workspaces`,
    details: `
      This command will run a given sub-command on current and all its descendant workspaces. Various flags can alter the exact behavior of the command:

      - If \`-p,--parallel\` is set, the commands will be ran in parallel; they'll by default be limited to a number of parallel tasks roughly equal to half your core number, but that can be overridden via \`-j,--jobs\`, or disabled by setting \`-j unlimited\`.

      - If \`-p,--parallel\` and \`-i,--interlaced\` are both set, Yarn will print the lines from the output as it receives them. If \`-i,--interlaced\` wasn't set, it would instead buffer the output from each process and print the resulting buffers only after their source processes have exited.

      - If \`-t,--topological\` is set, Yarn will only run the command after all workspaces that it depends on through the \`dependencies\` field have successfully finished executing. If \`--topological-dev\` is set, both the \`dependencies\` and \`devDependencies\` fields will be considered when figuring out the wait points.

      - If \`-A,--all\` is set, Yarn will run the command on all the workspaces of a project.

      - If \`-R,--recursive\` is set, Yarn will find workspaces to run the command on by recursively evaluating \`dependencies\` and \`devDependencies\` fields, instead of looking at the \`workspaces\` fields.

      - If \`-W,--worktree\` is set, Yarn will find workspaces to run the command on by looking at the current worktree.

      - If \`--from\` is set, Yarn will use the packages matching the 'from' glob as the starting point for any recursive search.

      - If \`--since\` is set, Yarn will only run the command on workspaces that have been modified since the specified ref. By default Yarn will use the refs specified by the \`changesetBaseRefs\` configuration option.

      - If \`--dry-run\` is set, Yarn will explain what it would do without actually doing anything.

      - The command may apply to only some workspaces through the use of \`--include\` which acts as a whitelist. The \`--exclude\` flag will do the opposite and will be a list of packages that mustn't execute the script. Both flags accept glob patterns (if valid Idents and supported by [micromatch](https://github.com/micromatch/micromatch)). Make sure to escape the patterns, to prevent your own shell from trying to expand them.

      Adding the \`-v,--verbose\` flag (automatically enabled in interactive terminal environments) will cause Yarn to print more information; in particular the name of the workspace that generated the output will be printed at the front of each line.

      If the command is \`run\` and the script being run does not exist the child workspace will be skipped without error.
    `,
    examples: [[
      `Publish all packages`,
      `yarn workspaces foreach -A npm publish --tolerate-republish`,
    ], [
      `Run the build script on all descendant packages`,
      `yarn workspaces foreach -A run build`,
    ], [
      `Run the build script on current and all descendant packages in parallel, building package dependencies first`,
      `yarn workspaces foreach -Apt run build`,
    ],
    [
      `Run the build script on several packages and all their dependencies, building dependencies first`,
      `yarn workspaces foreach -Rpt --from '{workspace-a,workspace-b}' run build`,
    ]],
  });

  static schema = [
    t.hasKeyRelationship(`all`, t.KeyRelationship.Forbids, [`from`, `recursive`, `since`, `worktree`], {missingIf: `undefined`}),
    t.hasAtLeastOneKey([`all`, `recursive`, `since`, `worktree`], {missingIf: `undefined`}),
  ];

  from = Option.Array(`--from`, {
    description: `An array of glob pattern idents or paths from which to base any recursion`,
  });

  all = Option.Boolean(`-A,--all`, {
    description: `Run the command on all workspaces of a project`,
  });

  recursive = Option.Boolean(`-R,--recursive`, {
    description: `Run the command on the current workspace and all of its recursive dependencies`,
  });

  worktree = Option.Boolean(`-W,--worktree`, {
    description: `Run the command on all workspaces of the current worktree`,
  });

  verbose = Option.Boolean(`-v,--verbose`, {
    description: `Prefix each output line with the name of the originating workspace`,
  });

  parallel = Option.Boolean(`-p,--parallel`, false, {
    description: `Run the commands in parallel`,
  });

  interlaced = Option.Boolean(`-i,--interlaced`, false, {
    description: `Print the output of commands in real-time instead of buffering it`,
  });

  jobs = Option.String(`-j,--jobs`, {
    description: `The maximum number of parallel tasks that the execution will be limited to; or \`unlimited\``,
    validator: t.isOneOf([t.isEnum([`unlimited`]), t.applyCascade(t.isNumber(), [t.isInteger(), t.isAtLeast(1)])]),
  });

  topological = Option.Boolean(`-t,--topological`, false, {
    description: `Run the command after all workspaces it depends on (regular) have finished`,
  });

  topologicalDev = Option.Boolean(`--topological-dev`, false, {
    description: `Run the command after all workspaces it depends on (regular + dev) have finished`,
  });

  include = Option.Array(`--include`, [], {
    description: `An array of glob pattern idents or paths; only matching workspaces will be traversed`,
  });

  exclude = Option.Array(`--exclude`, [], {
    description: `An array of glob pattern idents or paths; matching workspaces won't be traversed`,
  });

  publicOnly = Option.Boolean(`--no-private`, {
    description: `Avoid running the command on private workspaces`,
  });

  since = Option.String(`--since`, {
    description: `Only include workspaces that have been changed since the specified ref.`,
    tolerateBoolean: true,
  });

  dryRun = Option.Boolean(`-n,--dry-run`, {
    description: `Print the commands that would be run, without actually running them`,
  });

  commandName = Option.String();
  args = Option.Proxy();

  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project, workspace: cwdWorkspace} = await Project.find(configuration, this.context.cwd);

    if (!this.all && !cwdWorkspace)
      throw new WorkspaceRequiredError(project.cwd, this.context.cwd);

    await project.restoreInstallState();

    const command = this.cli.process([this.commandName, ...this.args]) as {path: Array<string>, scriptName?: string};
    const scriptName = command.path.length === 1 && command.path[0] === `run` && typeof command.scriptName !== `undefined`
      ? command.scriptName
      : null;

    if (command.path.length === 0)
      throw new UsageError(`Invalid subcommand name for iteration - use the 'run' keyword if you wish to execute a script`);

    const log = (msg: string) => {
      if (!this.dryRun)
        return;

      this.context.stdout.write(`${msg}\n`);
    };

    const getFromWorkspaces = () => {
      const matchers = this.from!.map(pattern => micromatch.matcher(pattern));

      return project.workspaces.filter(workspace => {
        const ident = structUtils.stringifyIdent(workspace.anchoredLocator);
        const cwd = workspace.relativeCwd;

        return matchers.some(match => match(ident) || match(cwd));
      });
    };

    let selection: Array<Workspace> = [];
    if (this.since) {
      log(`Option --since is set; selecting the changed workspaces as root for workspace selection`);
      selection = Array.from(await gitUtils.fetchChangedWorkspaces({ref: this.since, project}));
    } else {
      if (this.from) {
        log(`Option --from is set; selecting the specified workspaces`);
        selection = [...getFromWorkspaces()];
      } else if (this.worktree) {
        log(`Option --worktree is set; selecting the current workspace`);
        selection = [cwdWorkspace!];
      } else if (this.recursive) {
        log(`Option --recursive is set; selecting the current workspace`);
        selection = [cwdWorkspace!];
      } else if (this.all) {
        log(`Option --all is set; selecting all workspaces`);
        selection = [...project.workspaces];
      }
    }

    if (this.dryRun && !this.all) {
      for (const workspace of selection)
        log(`\n- ${workspace.relativeCwd}\n  ${structUtils.prettyLocator(configuration, workspace.anchoredLocator)}`);

      if (selection.length > 0) {
        log(``);
      }
    }

    let extra: Set<Workspace> | null;
    if (this.recursive) {
      if (this.since) {
        log(`Option --recursive --since is set; recursively selecting all dependent workspaces`);
        extra = new Set(selection.map(workspace => [...workspace.getRecursiveWorkspaceDependents()]).flat());
      } else {
        log(`Option --recursive is set; recursively selecting all transitive dependencies`);
        extra = new Set(selection.map(workspace => [...workspace.getRecursiveWorkspaceDependencies()]).flat());
      }
    } else if (this.worktree) {
      log(`Option --worktree is set; recursively selecting all nested workspaces`);
      extra = new Set(selection.map(workspace => [...workspace.getRecursiveWorkspaceChildren()]).flat());
    } else {
      extra = null;
    }

    if (extra !== null) {
      selection = [...new Set([
        ...selection,
        ...extra,
      ])];

      if (this.dryRun) {
        for (const workspace of extra) {
          log(`\n- ${workspace.relativeCwd}\n  ${structUtils.prettyLocator(configuration, workspace.anchoredLocator)}`);
        }
      }
    }

    const workspaces: Array<Workspace> = [];

    // A script containing `:` becomes global if it exists in only one workspace.
    let isGlobalScript = false;
    if (scriptName?.includes(`:`)) {
      for (const workspace of project.workspaces) {
        if (workspace.manifest.scripts.has(scriptName)) {
          isGlobalScript = !isGlobalScript;
          if (isGlobalScript === false) {
            break;
          }
        }
      }
    }

    for (const workspace of selection) {
      if (scriptName && !workspace.manifest.scripts.has(scriptName) && !isGlobalScript) {
        const accessibleBinaries = await scriptUtils.getWorkspaceAccessibleBinaries(workspace);
        if (!accessibleBinaries.has(scriptName)) {
          log(`Excluding ${workspace.relativeCwd} because it doesn't have a "${scriptName}" script`);
          continue;
        }
      }

      // Prevents infinite loop in the case of configuring a script as such:
      // "lint": "yarn workspaces foreach --all lint"
      if (scriptName === configuration.env.npm_lifecycle_event && workspace.cwd === cwdWorkspace!.cwd)
        continue;

      if (this.include.length > 0 && !micromatch.isMatch(structUtils.stringifyIdent(workspace.anchoredLocator), this.include) && !micromatch.isMatch(workspace.relativeCwd, this.include)) {
        log(`Excluding ${workspace.relativeCwd} because it doesn't match the --include filter`);
        continue;
      }

      if (this.exclude.length > 0 && (micromatch.isMatch(structUtils.stringifyIdent(workspace.anchoredLocator), this.exclude) || micromatch.isMatch(workspace.relativeCwd,  this.exclude))) {
        log(`Excluding ${workspace.relativeCwd} because it matches the --include filter`);
        continue;
      }

      if (this.publicOnly && workspace.manifest.private === true) {
        log(`Excluding ${workspace.relativeCwd} because it's a private workspace and --no-private was set`);
        continue;
      }

      workspaces.push(workspace);
    }

    if (this.dryRun)
      return 0;

    // --verbose is automatically enabled in TTYs
    const verbose = this.verbose ?? (this.context.stdout as WriteStream).isTTY;

    const concurrency = this.parallel ?
      (this.jobs === `unlimited`
        ? Infinity
        : Number(this.jobs) || Math.ceil(nodeUtils.availableParallelism() / 2))
      : 1;

    // No need to parallelize if we were explicitly asked for one job
    const parallel = concurrency === 1 ? false : this.parallel;
    // No need to buffer the output if we're executing the commands sequentially
    const interlaced = parallel ? this.interlaced : true;

    const limit = pLimit(concurrency);

    const needsProcessing = new Map<LocatorHash, Workspace>();
    const processing = new Set<DescriptorHash>();

    let commandCount = 0;
    let finalExitCode: number | null = null;

    let abortNextCommands = false;

    const report = await StreamReport.start({
      configuration,
      stdout: this.context.stdout,
      includePrefix: false,
    }, async report => {
      const runCommand = async (workspace: Workspace, {commandIndex}: {commandIndex: number}) => {
        if (abortNextCommands)
          return -1;

        if (!parallel && verbose && commandIndex > 1)
          report.reportSeparator();

        const prefix = getPrefix(workspace, {configuration, verbose, commandIndex});

        const [stdout, stdoutEnd] = createStream(report, {prefix, interlaced});
        const [stderr, stderrEnd] = createStream(report, {prefix, interlaced});

        try {
          if (verbose)
            report.reportInfo(null, `${prefix} Process started`);

          const start = Date.now();

          const exitCode = (await this.cli.run([this.commandName, ...this.args], {
            cwd: workspace.cwd,
            stdout,
            stderr,
          })) || 0;

          stdout.end();
          stderr.end();

          await stdoutEnd;
          await stderrEnd;

          const end = Date.now();
          if (verbose) {
            const timerMessage = configuration.get(`enableTimers`) ? `, completed in ${formatUtils.pretty(configuration, end - start, formatUtils.Type.DURATION)}` : ``;
            report.reportInfo(null, `${prefix} Process exited (exit code ${exitCode})${timerMessage}`);
          }

          if (exitCode === 130) {
            // Process exited with the SIGINT signal, aka ctrl+c. Since the process didn't handle
            // the signal but chose to exit, we should exit as well.
            abortNextCommands = true;
            finalExitCode = exitCode;
          }

          return exitCode;
        } catch (err) {
          stdout.end();
          stderr.end();

          await stdoutEnd;
          await stderrEnd;

          throw err;
        }
      };

      for (const workspace of workspaces)
        needsProcessing.set(workspace.anchoredLocator.locatorHash, workspace);

      while (needsProcessing.size > 0) {
        if (report.hasErrors())
          break;

        const commandPromises = [];

        for (const [identHash, workspace] of needsProcessing) {
          // If we are already running the command on that workspace, skip
          if (processing.has(workspace.anchoredDescriptor.descriptorHash))
            continue;

          let isRunnable = true;

          if (this.topological || this.topologicalDev) {
            const resolvedSet = this.topologicalDev
              ? new Map([...workspace.manifest.dependencies, ...workspace.manifest.devDependencies])
              : workspace.manifest.dependencies;

            for (const descriptor of resolvedSet.values()) {
              const workspace = project.tryWorkspaceByDescriptor(descriptor);
              isRunnable = workspace === null || !needsProcessing.has(workspace.anchoredLocator.locatorHash);

              if (!isRunnable) {
                break;
              }
            }
          }

          if (!isRunnable)
            continue;

          processing.add(workspace.anchoredDescriptor.descriptorHash);

          commandPromises.push(limit(async () => {
            const exitCode = await runCommand(workspace, {
              commandIndex: ++commandCount,
            });

            needsProcessing.delete(identHash);
            processing.delete(workspace.anchoredDescriptor.descriptorHash);

            return exitCode;
          }));

          // If we're not executing processes in parallel we can just wait for it
          // to finish outside of this loop (it'll then reenter it anyway)
          if (!parallel) {
            break;
          }
        }

        if (commandPromises.length === 0) {
          const cycle = Array.from(needsProcessing.values()).map(workspace => {
            return structUtils.prettyLocator(configuration, workspace.anchoredLocator);
          }).join(`, `);

          report.reportError(MessageName.CYCLIC_DEPENDENCIES, `Dependency cycle detected (${cycle})`);
          return;
        }

        const exitCodes: Array<number> = await Promise.all(commandPromises);
        const errorCode = exitCodes.find(code => code !== 0);

        // The order in which the exit codes will be processed is fairly
        // opaque, so better just return a generic "1" for determinism.
        if (finalExitCode === null)
          finalExitCode = typeof errorCode !== `undefined` ? 1 : finalExitCode;

        if ((this.topological || this.topologicalDev) && typeof errorCode !== `undefined`) {
          report.reportError(MessageName.UNNAMED, `The command failed for workspaces that are depended upon by other workspaces; can't satisfy the dependency graph`);
        }
      }
    });

    if (finalExitCode !== null) {
      return finalExitCode;
    } else {
      return report.exitCode();
    }
  }
}


function createStream(report: Report, {prefix, interlaced}: {prefix: string | null, interlaced: boolean}): [Writable, Promise<boolean>] {
  const streamReporter = report.createStreamReporter(prefix);

  const defaultStream = new miscUtils.DefaultStream();
  defaultStream.pipe(streamReporter, {end: false});
  defaultStream.on(`finish`, () => {
    streamReporter.end();
  });

  const promise = new Promise<boolean>(resolve => {
    streamReporter.on(`finish`, () => {
      resolve(defaultStream.active);
    });
  });

  if (interlaced)
    return [defaultStream, promise];

  const streamBuffer = new miscUtils.BufferStream();
  streamBuffer.pipe(defaultStream, {end: false});
  streamBuffer.on(`finish`, () => {
    defaultStream.end();
  });

  return [streamBuffer, promise];
}

type GetPrefixOptions = {
  configuration: Configuration;
  commandIndex: number;
  verbose: boolean;
};

function getPrefix(workspace: Workspace, {configuration, commandIndex, verbose}: GetPrefixOptions) {
  if (!verbose)
    return null;

  const name = structUtils.stringifyIdent(workspace.anchoredLocator);

  const prefix = `[${name}]:`;

  const colors = [`#2E86AB`, `#A23B72`, `#F18F01`, `#C73E1D`, `#CCE2A3`];
  const colorName = colors[commandIndex % colors.length];

  return formatUtils.pretty(configuration, prefix, colorName);
}
