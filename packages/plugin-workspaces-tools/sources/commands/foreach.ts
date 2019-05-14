import { Configuration, IdentHash, PluginConfiguration, Project, Workspace } from '@berry/core';
import { structUtils, Cache, DescriptorHash, StreamReport }                  from '@berry/core';
import { Writable }                                                          from 'stream';
import { cpus }                                                              from 'os';
// @ts-ignore
import pLimit                                                                from 'p-limit';

import * as workspaceUtils                                                   from '../workspaceUtils';

type ForeachOptions = {
  args: Array<string>;
  command: string;
  cwd: string;
  exclude: string[];
  include: string[];
  interlaced: boolean;
  parallel: boolean;
  prefixed: boolean;
  stdout: Writable;
  withDependencies: boolean;
}

// eslint-disable-next-line arca/no-default-export
export default (clipanion: any, pluginConfiguration: PluginConfiguration) => clipanion

    .command(`workspaces foreach <command> [...args] [-p,--parallel] [--with-dependencies] [-I,--interlaced] [-P,--prefixed] [-i,--include WORKSPACES...] [-x,--exclude WORKSPACES...]`)
    .flags({proxyArguments: true})

    .categorize(`Workspace-related commands`)
    .describe(`run a command on all workspaces`)

    .action(
      async ({cwd, args, stdout, command, exclude, include, interlaced, parallel, withDependencies, prefixed, ...env}: ForeachOptions) => {
        const configuration = await Configuration.find(cwd, pluginConfiguration);
        const { project } = await Project.find(configuration, cwd);
        const cache = await Cache.find(configuration);

        const needsProcessing = new Map<IdentHash, Workspace>();
        const processing = new Set<DescriptorHash>();
        const concurrency = parallel ? Math.max(1, cpus().length / 2) : 1;
        const limit = pLimit(concurrency);
        let commandCount = 0;

        const report = await StreamReport.start({configuration, stdout}, async report => {
          await project.resolveEverything({lockfileOnly: true, cache, report});

          let workspaces = command.toLocaleLowerCase() === `run`
            ? project.workspaces.filter(workspace => workspace.manifest.scripts.has(args[0]))
            : project.workspaces;

          if (include.length > 0) {
            workspaces = workspaces.filter(workspace => include.includes(workspace.locator.name))
          }

          if (exclude.length > 0) {
            workspaces = workspaces.filter(workspace => !exclude.includes(workspace.locator.name))
          }

          for (const workspace of workspaces) {
            const ident = structUtils.convertToIdent(workspace.locator);

            needsProcessing.set(ident.identHash, workspace);
          }

          while (needsProcessing.size > 0) {
            const commandPromises = [];

            for (const [identHash, workspace] of needsProcessing) {
              // If we are already running the command on that workspace, skip
              if (processing.has(workspace.anchoredDescriptor.descriptorHash)) {
                continue;
              }

              let isRunnable = true;

              // By default we do topological, however we don't care of the order when running
              // in --parallel unless also given the --with-dependencies flag
              if (!parallel || withDependencies) {
                for (const dep of workspace.dependencies.keys()) {
                  if (needsProcessing.has(dep))
                    isRunnable = false;
                }
              }

              if (!isRunnable) {
                continue;
              }

              processing.add(workspace.anchoredDescriptor.descriptorHash);

              commandPromises.push(limit(async () => {
                commandCount += 1;
                await runCommand(workspace);
                needsProcessing.delete(identHash);
                processing.delete(workspace.anchoredDescriptor.descriptorHash);
              }));
            }

            await Promise.all(commandPromises);
          }

          async function runCommand(workspace: Workspace) {
            const prefix = workspaceUtils.getPrefix({ configuration, workspace, prefixed, commandCount});
            const stdout = workspaceUtils.createStream({prefix, report, interlaced});
            const stderr = workspaceUtils.createStream({prefix, report, interlaced});

            try {
              await clipanion.run(null, args, {
                ...env,
                cwd: workspace.cwd,
                stdout: stdout.stream,
                stderr: stderr.stream,
              });
            } finally {
              stdout.stream.end();
              stderr.stream.end();
            }

            // We wait so that report doesn't log the Finished message until its
            // really done.
            await stdout.promise;
            await stderr.promise;
          }
        });

        return report.exitCode();
      }
    );
