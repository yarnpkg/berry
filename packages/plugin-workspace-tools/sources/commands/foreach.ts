import {Configuration, LocatorHash, PluginConfiguration, Project, Workspace} from '@berry/core';
import {DescriptorHash, MessageName, Report, StreamReport}                   from '@berry/core';
import {miscUtils, structUtils}                                              from '@berry/core';
import {PortablePath}                                                        from '@berry/fslib';
import {cpus}                                                                from 'os';
import pLimit                                                                from 'p-limit';
import {Writable}                                                            from 'stream';
import * as yup                                                              from 'yup';

type ForeachOptions = {
  args: Array<string>;
  command: string;
  cwd: PortablePath;
  exclude: string[];
  include: string[];
  interlaced: boolean;
  jobs: number;
  parallel: boolean;
  stdout: Writable;
  topologicalDev: boolean;
  topological: boolean;
  verbose: boolean;
}

// eslint-disable-next-line arca/no-default-export
export default (clipanion: any, pluginConfiguration: PluginConfiguration) => clipanion

  .command(`workspaces foreach run <command> [...args] [-v,--verbose] [-p,--parallel] [-i,--interlaced] [-j,--jobs JOBS] [--topological] [--topological-dev] [--include WORKSPACES...] [--exclude WORKSPACES...]`)
  .categorize(`Workspace-related commands`)
  .describe(`run a command on all workspaces`)
  .flags({proxyArguments: true})

  .detail(`
    This command will run a given sub-command on all workspaces that define it (any workspace that doesn't define it will be just skiped). Various flags can alter the exact behavior of the command:

    - If \`-p,--parallel\` is set, the commands will run in parallel; they'll by default be limited to a number of parallel tasks roughly equal to half your core number, but that can be overriden via \`-j,--jobs\`.

    - If \`-p,--parallel\` and \`-i,--interlaced\` are both set, Yarn will print the lines from the output as it receives them. If \`-i,--interlaced\` wasn't set, it would instead buffer the output from each process and print the resulting buffers only after their source processes have exited.

    - If \`--topological\` is set, Yarn will only run a command after all workspaces that depend on it through the \`dependencies\` field have successfully finished executing. If \`--tological-dev\` is set, both the \`dependencies\` and \`devDependencies\` fields will be considered when figuring out the wait points.

    - The command may apply to only some workspaces through the use of \`--include\` which acts as a whitelist. The \`--exclude\` flag will do the opposite and will be a list of packages that musn't execute the script.

    Adding the \`-v,--verbose\` flag will cause Yarn to print more information; in particular the name of the workspace that generated the output will be printed at the front of each line.
  `)

  .validate(yup.object().shape({
    jobs: yup.number().min(2),
    parallel: yup.boolean().when(`jobs`, {
      is: val => val > 1,
      then: yup.boolean().oneOf([true], `--parallel must be set when using --jobs`),
      otherwise: yup.boolean(),
    }),
  }))

  .action(
    async ({cwd, args, stdout, command, exclude, include, interlaced, parallel, topological, topologicalDev, verbose, jobs, ...env}: ForeachOptions) => {
      const configuration = await Configuration.find(cwd, pluginConfiguration);
      const {project} = await Project.find(configuration, cwd);

      let workspaces = project.workspaces.filter(workspace => workspace.manifest.scripts.has(command));

      if (include.length > 0)
        workspaces = workspaces.filter(workspace => include.includes(workspace.locator.name))

      if (exclude.length > 0)
        workspaces = workspaces.filter(workspace => !exclude.includes(workspace.locator.name))

      // No need to buffer the output if we're executing the commands sequentially
      if (!parallel)
        interlaced = true;

      const needsProcessing = new Map<LocatorHash, Workspace>();
      const processing = new Set<DescriptorHash>();

      const concurrency = parallel ? Math.max(1, cpus().length / 2) : 1;
      const limit = pLimit(jobs || concurrency);

      let commandCount = 0;

      const report = await StreamReport.start({configuration, stdout}, async report => {
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

            if (topological || topologicalDev) {
              const resolvedSet = topologicalDev
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
            if (!parallel) {
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

          if ((topological || topologicalDev) && exitCodes.some(exitCode => exitCode !== 0)) {
            report.reportError(MessageName.UNNAMED, `The command failed for workspaces that are depended upon by other workspaces; can't satisfy the dependency graph`);
          }
        }

        async function runCommand(workspace: Workspace, {commandIndex}: {commandIndex: number}) {
          if (!parallel && verbose && commandIndex > 1)
            report.reportSeparator();

          const prefix = getPrefix(workspace, {configuration, verbose, commandIndex});

          const [stdout, stdoutEnd] = createStream(report, {prefix, interlaced});
          const [stderr, stderrEnd] = createStream(report, {prefix, interlaced});

          try {
            const exitCode = await clipanion.run(null, [`run`, command, ...args], {
              ...env,
              cwd: workspace.cwd,
              stdout: stdout,
              stderr: stderr,
            });

            stdout.end();
            stderr.end();

            const emptyStdout = await stdoutEnd;
            const emptyStderr = await stderrEnd;

            if (verbose && emptyStdout && emptyStderr)
              report.reportInfo(null, `${prefix} Process exited without output (exit code ${exitCode || 0})`);

            return exitCode || 0;
          } catch (err) {
            stdout.end();
            stderr.end();

            await stdoutEnd;
            await stderrEnd;

            throw err;
          }
        }
      });

      return report.exitCode();
    }
  );


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
