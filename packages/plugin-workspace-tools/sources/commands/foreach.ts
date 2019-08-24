import {BaseCommand, WorkspaceRequiredError}               from '@berry/cli';
import {Configuration, LocatorHash, Project, Workspace}    from '@berry/core';
import {DescriptorHash, MessageName, Report, StreamReport} from '@berry/core';
import {miscUtils, structUtils}                            from '@berry/core';
import {Command, UsageError}                               from 'clipanion';
import {cpus}                                              from 'os';
import pLimit                                              from 'p-limit';
import {Writable}                                          from 'stream';
import * as yup                                            from 'yup';

/**
 * Retrieves all the child workspaces of a given root workspace recursively
 *
 * @param rootWorkspace root workspace
 * @param project project
 *
 * @returns all the child workspaces
 */
const getWorkspaceChildrenRecursive = (rootWorkspace: Workspace, project: Project): Array<Workspace> => {
  const workspaceList = [];
  for (const childWorkspaceCwd of rootWorkspace.workspacesCwds) {
    const childWorkspace = project.workspacesByCwd.get(childWorkspaceCwd);
    if (childWorkspace) {
      workspaceList.push(childWorkspace, ...getWorkspaceChildrenRecursive(childWorkspace, project));
    }
  }
  return workspaceList;
};

// eslint-disable-next-line arca/no-default-export
export default class WorkspacesForeachCommand extends BaseCommand {
  @Command.String()
  commandName!: string;

  @Command.Proxy()
  args: Array<string> = [];

  @Command.Boolean(`-a,--all`)
  all: boolean = false;

  @Command.Boolean(`-v,--verbose`)
  verbose: boolean = false;

  @Command.Boolean(`-p,--parallel`)
  parallel: boolean = false;

  @Command.Boolean(`-i,--interlaced`)
  interlaced: boolean = false;

  @Command.String(`-j,--jobs`)
  jobs?: number;

  @Command.Boolean(`-t,--topological`)
  topological: boolean = false;

  @Command.Boolean(`--topological-dev`)
  topologicalDev: boolean = false;

  @Command.Array(`--include`)
  include: Array<string> = [];

  @Command.Array(`--exclude`)
  exclude: Array<string> = [];

  @Command.Boolean(`--private`)
  private: boolean = true;

  static schema = yup.object().shape({
    jobs: yup.number().min(2),
    parallel: yup.boolean().when(`jobs`, {
      is: (val: number) => val > 1,
      then: yup.boolean().oneOf([true], `--parallel must be set when using --jobs`),
      otherwise: yup.boolean(),
    }),
  });

  static usage = Command.Usage({
    category: `Workspace-related commands`,
    description: `run a command on all workspaces`,
    details: `
      This command will run a given sub-command on all child workspaces that define it (any workspace that doesn't define it will be just skiped). Various flags can alter the exact behavior of the command:

      - If \`-p,--parallel\` is set, the commands will run in parallel; they'll by default be limited to a number of parallel tasks roughly equal to half your core number, but that can be overriden via \`-j,--jobs\`.

      - If \`-p,--parallel\` and \`-i,--interlaced\` are both set, Yarn will print the lines from the output as it receives them. If \`-i,--interlaced\` wasn't set, it would instead buffer the output from each process and print the resulting buffers only after their source processes have exited.

      - If \`-t,--topological\` is set, Yarn will only run a command after all workspaces that depend on it through the \`dependencies\` field have successfully finished executing. If \`--tological-dev\` is set, both the \`dependencies\` and \`devDependencies\` fields will be considered when figuring out the wait points.

      - If \`--all\` is set, Yarn will run it on all the workspaces of a project. By default it runs the command only on child workspaces.

      - The command may apply to only some workspaces through the use of \`--include\` which acts as a whitelist. The \`--exclude\` flag will do the opposite and will be a list of packages that musn't execute the script.

      Adding the \`-v,--verbose\` flag will cause Yarn to print more information; in particular the name of the workspace that generated the output will be printed at the front of each line.

      If the command is \`run\` and the script being run does not exist the child workspace will be skipped without error.
    `,
    examples: [[
      `Publish all the packages in a workspace`,
      `yarn workspaces foreach npm publish --tolerate-republish`,
    ], [
      `Run build script on all the packages in a workspace`,
      `yarn workspaces foreach run build`,
    ], [
      `Run build script on all the packages in a workspace in parallel, building dependent packages first`,
      `yarn workspaces foreach -pt run build`,
    ]],
  });

  @Command.Path(`workspaces`, `foreach`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project, workspace: cwdWorkspace} = await Project.find(configuration, this.context.cwd);

    if (!this.all && !cwdWorkspace)
      throw new WorkspaceRequiredError(this.context.cwd);

    const command = this.cli.process([this.commandName, ...this.args]) as {path: string[], scriptName?: string};
    const scriptName = command.path.length === 1 && command.path[0] === `run` && typeof command.scriptName !== `undefined`
      ? command.scriptName
      : null;

    if (command.path.length === 0)
      throw new UsageError(`Invalid subcommand name for iteration - use the 'run' keyword if you wish to execute a script`);

    const rootWorkspace = this.all
      ? project.topLevelWorkspace
      : cwdWorkspace!;

    const candidates = [rootWorkspace, ...getWorkspaceChildrenRecursive(rootWorkspace, project)];
    const workspaces: Array<Workspace> = [];

    for (const workspace of candidates) {
      if (scriptName && !workspace.manifest.scripts.has(scriptName))
        continue;

      // Prevents infinite loop in the case of configuring a script as such:
      // "lint": "yarn workspaces foreach --all lint"
      if (scriptName === process.env.npm_lifecycle_event && workspace.cwd === cwdWorkspace!.cwd)
        continue;

      if (this.include.length > 0 && !this.include.includes(workspace.locator.name))
        continue;

      if (this.exclude.length > 0 && this.exclude.includes(workspace.locator.name))
        continue;

      if (this.private === false && workspace.manifest['private'] === true)
        continue

      workspaces.push(workspace);
    }

    let interlaced = this.interlaced;

    // No need to buffer the output if we're executing the commands sequentially
    if (!this.parallel)
      interlaced = true;

    const needsProcessing = new Map<LocatorHash, Workspace>();
    const processing = new Set<DescriptorHash>();

    const concurrency = this.parallel ? Math.max(1, cpus().length / 2) : 1;
    const limit = pLimit(this.jobs || concurrency);

    let commandCount = 0;

    const report = await StreamReport.start({
      configuration,
      stdout: this.context.stdout,
    }, async report => {
      const runCommand = async (workspace: Workspace, {commandIndex}: {commandIndex: number}) => {
        if (!this.parallel && this.verbose && commandIndex > 1)
          report.reportSeparator();

        const prefix = getPrefix(workspace, {configuration, verbose: this.verbose, commandIndex});

        const [stdout, stdoutEnd] = createStream(report, {prefix, interlaced});
        const [stderr, stderrEnd] = createStream(report, {prefix, interlaced});

        try {
          const exitCode = (await this.cli.run([this.commandName, ...this.args], {
            cwd: workspace.cwd,
            stdout,
            stderr,
          })) || 0;

          stdout.end();
          stderr.end();

          const emptyStdout = await stdoutEnd;
          const emptyStderr = await stderrEnd;

          if (this.verbose && emptyStdout && emptyStderr)
            report.reportInfo(null, `${prefix} Process exited without output (exit code ${exitCode})`);

          return exitCode;
        } catch (err) {
          stdout.end();
          stderr.end();

          await stdoutEnd;
          await stderrEnd;

          throw err;
        }
      }

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
              ? [...workspace.manifest.dependencies, ...workspace.manifest.devDependencies]
              : workspace.manifest.dependencies;

            for (const [/*identHash*/, descriptor] of resolvedSet) {
              const workspaces = project.findWorkspacesByDescriptor(descriptor);

              isRunnable = !workspaces.some(workspace => {
                return needsProcessing.has(workspace.anchoredLocator.locatorHash);
              });

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
          if (!this.parallel) {
            break;
          }
        }

        if (commandPromises.length === 0) {
          const cycle = Array.from(needsProcessing.values()).map(workspace => {
            return structUtils.prettyLocator(configuration, workspace.anchoredLocator);
          }).join(`, `);

          return report.reportError(MessageName.CYCLIC_DEPENDENCIES, `Dependency cycle detected (${cycle})`);
        }

        const exitCodes: Array<number> = await Promise.all(commandPromises);

        if ((this.topological || this.topologicalDev) && exitCodes.some(exitCode => exitCode !== 0)) {
          report.reportError(MessageName.UNNAMED, `The command failed for workspaces that are depended upon by other workspaces; can't satisfy the dependency graph`);
        }
      }
    });

    return report.exitCode();
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

  let prefix = `[${name}]:`;

  const colors = [`#2E86AB`, `#A23B72`, `#F18F01`, `#C73E1D`, `#CCE2A3`];
  const colorName = colors[commandIndex % colors.length];

  return configuration.format(prefix, colorName);
}
