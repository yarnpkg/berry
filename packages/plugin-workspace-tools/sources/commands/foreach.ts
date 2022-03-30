import {BaseCommand, WorkspaceRequiredError}                         from '@yarnpkg/cli';
import {Configuration, LocatorHash, Project, scriptUtils, Workspace} from '@yarnpkg/core';
import {DescriptorHash, MessageName, Report, StreamReport}           from '@yarnpkg/core';
import {formatUtils, miscUtils, structUtils}                         from '@yarnpkg/core';
import {gitUtils}                                                    from '@yarnpkg/plugin-git';
import {Command, Option, Usage, UsageError}                          from 'clipanion';
import micromatch                                                    from 'micromatch';
import {cpus}                                                        from 'os';
import pLimit                                                        from 'p-limit';
import {Writable}                                                    from 'stream';
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

      - If \`-A,--all\` is set, Yarn will run the command on all the workspaces of a project. By default yarn runs the command only on current and all its descendant workspaces.

      - If \`-R,--recursive\` is set, Yarn will find workspaces to run the command on by recursively evaluating \`dependencies\` and \`devDependencies\` fields, instead of looking at the \`workspaces\` fields.

      - If \`--from\` is set, Yarn will use the packages matching the 'from' glob as the starting point for any recursive search.

      - If \`--since\` is set, Yarn will only run the command on workspaces that have been modified since the specified ref. By default Yarn will use the refs specified by the \`changesetBaseRefs\` configuration option.

      - The command may apply to only some workspaces through the use of \`--include\` which acts as a whitelist. The \`--exclude\` flag will do the opposite and will be a list of packages that mustn't execute the script. Both flags accept glob patterns (if valid Idents and supported by [micromatch](https://github.com/micromatch/micromatch)). Make sure to escape the patterns, to prevent your own shell from trying to expand them.

      Adding the \`-v,--verbose\` flag will cause Yarn to print more information; in particular the name of the workspace that generated the output will be printed at the front of each line.

      If the command is \`run\` and the script being run does not exist the child workspace will be skipped without error.
    `,
    examples: [[
      `Publish current and all descendant packages`,
      `yarn workspaces foreach npm publish --tolerate-republish`,
    ], [
      `Run build script on current and all descendant packages`,
      `yarn workspaces foreach run build`,
    ], [
      `Run build script on current and all descendant packages in parallel, building package dependencies first`,
      `yarn workspaces foreach -pt run build`,
    ],
    [
      `Run build script on several packages and all their dependencies, building dependencies first`,
      `yarn workspaces foreach -ptR --from '{workspace-a,workspace-b}' run build`,
    ]],
  });

  recursive = Option.Boolean(`-R,--recursive`, false, {
    description: `Find packages via dependencies/devDependencies instead of using the workspaces field`,
  });

  from = Option.Array(`--from`, [], {
    description: `An array of glob pattern idents from which to base any recursion`,
  });

  all = Option.Boolean(`-A,--all`, false, {
    description: `Run the command on all workspaces of a project`,
  });

  verbose = Option.Boolean(`-v,--verbose`, false, {
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
    description: `An array of glob pattern idents; only matching workspaces will be traversed`,
  });

  exclude = Option.Array(`--exclude`, [], {
    description: `An array of glob pattern idents; matching workspaces won't be traversed`,
  });

  publicOnly = Option.Boolean(`--no-private`, {
    description: `Avoid running the command on private workspaces`,
  });

  since = Option.String(`--since`, {
    description: `Only include workspaces that have been changed since the specified ref.`,
    tolerateBoolean: true,
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

    const rootWorkspace = this.all
      ? project.topLevelWorkspace
      : cwdWorkspace!;

    const rootCandidates = this.since
      ? Array.from(await gitUtils.fetchChangedWorkspaces({ref: this.since, project}))
      : [rootWorkspace, ...(this.from.length > 0 ? rootWorkspace.getRecursiveWorkspaceChildren() : [])];

    const fromPredicate = (workspace: Workspace) => micromatch.isMatch(structUtils.stringifyIdent(workspace.locator), this.from);
    const fromCandidates: Array<Workspace> = this.from.length > 0
      ? rootCandidates.filter(fromPredicate)
      : rootCandidates;

    const candidates = new Set([...fromCandidates, ...(fromCandidates.map(candidate => [...(
      this.recursive
        ? this.since
          ? candidate.getRecursiveWorkspaceDependents()
          : candidate.getRecursiveWorkspaceDependencies()
        : candidate.getRecursiveWorkspaceChildren()
    )])).flat()]);

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

    for (const workspace of candidates) {
      if (scriptName && !workspace.manifest.scripts.has(scriptName) && !isGlobalScript) {
        const accessibleBinaries = await scriptUtils.getWorkspaceAccessibleBinaries(workspace);
        if (!accessibleBinaries.has(scriptName)) {
          continue;
        }
      }

      // Prevents infinite loop in the case of configuring a script as such:
      // "lint": "yarn workspaces foreach --all lint"
      if (scriptName === process.env.npm_lifecycle_event && workspace.cwd === cwdWorkspace!.cwd)
        continue;

      if (this.include.length > 0 && !micromatch.isMatch(structUtils.stringifyIdent(workspace.locator), this.include))
        continue;

      if (this.exclude.length > 0 && micromatch.isMatch(structUtils.stringifyIdent(workspace.locator), this.exclude))
        continue;

      if (this.publicOnly && workspace.manifest.private === true)
        continue;

      workspaces.push(workspace);
    }

    const concurrency = this.parallel ?
      (this.jobs === `unlimited`
        ? Infinity
        : this.jobs || Math.max(1, cpus().length / 2))
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
    }, async report => {
      const runCommand = async (workspace: Workspace, {commandIndex}: {commandIndex: number}) => {
        if (abortNextCommands)
          return -1;

        if (!parallel && this.verbose && commandIndex > 1)
          report.reportSeparator();

        const prefix = getPrefix(workspace, {configuration, verbose: this.verbose, commandIndex});

        const [stdout, stdoutEnd] = createStream(report, {prefix, interlaced});
        const [stderr, stderrEnd] = createStream(report, {prefix, interlaced});

        try {
          if (this.verbose)
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
          if (this.verbose) {
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

  const ident = structUtils.convertToIdent(workspace.locator);
  const name = structUtils.stringifyIdent(ident);

  const prefix = `[${name}]:`;

  const colors = [`#2E86AB`, `#A23B72`, `#F18F01`, `#C73E1D`, `#CCE2A3`];
  const colorName = colors[commandIndex % colors.length];

  return formatUtils.pretty(configuration, prefix, colorName);
}
