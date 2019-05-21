import {Configuration, LocatorHash, PluginConfiguration, Project, Workspace}     from '@berry/core';
import {Cache, DescriptorHash, LightReport, MessageName, Report, StreamReport}   from '@berry/core';
import {miscUtils, structUtils}                                                  from '@berry/core';
import {PortablePath}                                                            from '@berry/fslib';
import {cpus}                                                                    from 'os';
import pLimit                                                                    from 'p-limit';
import {Writable}                                                                from 'stream';
import * as yup                                                                  from 'yup';


type ForeachOptions = {
  args: Array<string>;
  command: string;
  cwd: PortablePath;
  exclude: string[];
  include: string[];
  interlaced: boolean;
  jobs: number;
  parallel: boolean;
  prefixed: boolean;
  stdout: Writable;
  withDependencies: boolean;
}

// eslint-disable-next-line arca/no-default-export
export default (clipanion: any, pluginConfiguration: PluginConfiguration) => clipanion

  .command(`workspaces foreach run <command> [...args] [-p,--parallel] [--with-dependencies] [-I,--interlaced] [-P,--prefixed] [-j,--jobs JOBS] [-i,--include WORKSPACES...] [-x,--exclude WORKSPACES...]`)
  .flags({proxyArguments: true})

  .validate(yup.object().shape({
    jobs: yup.number().min(2),
    parallel: yup.boolean().when('jobs', {
      is: val => val > 1,
      then: yup.boolean().oneOf([true], '--parallel must be set when using --jobs'),
      otherwise: yup.boolean(),
    }),
  }))

  .categorize(`Workspace-related commands`)
  .describe(`run a command on all workspaces`)

  .action(
    async ({cwd, args, stdout, command, exclude, include, interlaced, parallel, withDependencies, prefixed, jobs, ...env}: ForeachOptions) => {
      const configuration = await Configuration.find(cwd, pluginConfiguration);
      const {project} = await Project.find(configuration, cwd);
      const cache = await Cache.find(configuration);

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

      const resolutionReport = await LightReport.start({configuration, stdout}, async (report: LightReport) => {
        await project.resolveEverything({lockfileOnly: true, cache, report});
      });

      if (resolutionReport.hasErrors())
        return resolutionReport.exitCode();

      const runReport = await StreamReport.start({configuration, stdout}, async report => {
        for (const workspace of workspaces)
          needsProcessing.set(workspace.anchoredLocator.locatorHash, workspace);

        while (needsProcessing.size > 0) {
          const commandPromises = [];

          for (const [identHash, workspace] of needsProcessing) {
            // If we are already running the command on that workspace, skip
            if (processing.has(workspace.anchoredDescriptor.descriptorHash))
              continue;

            let isRunnable = true;

            // By default we do topological, however we don't care of the order when running
            // in --parallel unless also given the --with-dependencies flag
            if (!parallel || withDependencies) {
              for (const [/*identHash*/, descriptor] of workspace.dependencies) {
                const locatorHash = project.storedResolutions.get(descriptor.descriptorHash);
                if (typeof locatorHash === `undefined`)
                  throw new Error(`Assertion failed: The resolution should have been registered`);

                if (needsProcessing.has(locatorHash)) {
                  isRunnable = false;
                  break;
                }
              }
            }

            if (!isRunnable)
              continue;

            processing.add(workspace.anchoredDescriptor.descriptorHash);

            commandPromises.push(limit(async () => {
              await runCommand(workspace, {
                commandIndex: ++commandCount,
              });

              needsProcessing.delete(identHash);
              processing.delete(workspace.anchoredDescriptor.descriptorHash);
            }));
          }

          if (commandPromises.length === 0)
            return report.reportError(MessageName.CYCLIC_DEPENDENCIES, `Dependency cycle detected`);

          await Promise.all(commandPromises);
        }

        async function runCommand(workspace: Workspace, {commandIndex}: {commandIndex: number}) {
          const prefix = getPrefix(workspace, {configuration, prefixed, commandIndex});

          const stdout = createStream(report, {prefix, interlaced});
          const stderr = createStream(report, {prefix, interlaced});

          try {
            await clipanion.run(null, [`run`, command, ...args], {
              ...env,
              cwd: workspace.cwd,
              stdout: stdout,
              stderr: stderr,
            });
          } finally {
            stdout.end();
            stderr.end();
          }
        }
      });

      return runReport.exitCode();
    }
  );


function createStream(report: Report, {prefix, interlaced}: {prefix: string | null, interlaced: boolean}) {
  const streamReporter = report.createStreamReporter(prefix);

  if (interlaced)
    return streamReporter;

  const streamBuffer = new miscUtils.BufferStream();
  streamBuffer.pipe(streamReporter);

  return streamBuffer;
}

type GetPrefixOptions = {
  configuration: Configuration;
  commandIndex: number;
  prefixed: boolean;
};

function getPrefix(workspace: Workspace, {configuration, commandIndex, prefixed}: GetPrefixOptions) {
  if (!prefixed)
    return null;

  const ident = structUtils.convertToIdent(workspace.locator);
  const name = structUtils.stringifyIdent(ident);

  let prefix = `[${name}]:`;

  const colors = [`cyan`, `green`, `yellow`, `blue`, `magenta`];
  const colorName = colors[commandIndex % colors.length];

  return configuration.format(prefix, colorName);
}
