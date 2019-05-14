import { Configuration, IdentHash, PluginConfiguration, Project, Workspace } from '@berry/core';
import { structUtils, Cache, DescriptorHash, StreamReport }                  from '@berry/core';
import { Writable }                                                          from 'stream';
import { cpus }                                                              from 'os';
import chalk                                                                 from 'chalk';
// @ts-ignore
import pLimit                                                                from 'p-limit';

// eslint-disable-next-line arca/no-default-export
export default (clipanion: any, pluginConfiguration: PluginConfiguration) => clipanion

    .command(`workspaces foreach <command> [...args] [-p,--parallel] [--with-dependencies] [-I,--interlaced] [-P,--prefixed] [-i,--include WORKSPACES...] [-x,--exclude WORKSPACES...]`)
    .flags({proxyArguments: true})

    .categorize(`Workspace-related commands`)
    .describe(`run a command on all workspaces`)

    .action(
      async ({cwd, args, stdout, command, exclude, include, interlaced, parallel, withDependencies, prefixed, ...env}: {cwd: string; args: Array<string>, stdout: Writable, command: string, exclude: string[], include: string[], parallel: boolean, withDependencies: boolean, interlaced: boolean, prefixed: boolean}) => {
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
            const colors = [`cyan`, `green`, `yellow`, `blue`, `magenta`];
            const colorsEnabled = configuration.get(`enableColors`);
            const ident = structUtils.convertToIdent(workspace.locator);
            const name = structUtils.stringifyIdent(ident);
            const colorName = colors[commandCount % colors.length];

            let prefixString = prefixed ? `[${name}]:` : null;

            if (prefixString && colorsEnabled) {
              prefixString = (chalk as any)[colorName](prefixString);
            }

            return await clipanion.run(null, args, {
              ...env,
              cwd: workspace.cwd,
              stdout: report.createStreamReporter(prefixString),
              stderr: report.createStreamReporter(prefixString),
            });
          }
        });

        return report.exitCode();
      }
    );
