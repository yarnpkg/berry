import {WorkspaceRequiredError}                                           from '@berry/cli';
import {Configuration, Cache, PluginConfiguration, Project, StreamReport} from '@berry/core';
import {structUtils}                                                      from '@berry/core';
import {Writable}                                                         from 'stream';

// eslint-disable-next-line arca/no-default-export
export default (clipanion: any, pluginConfiguration: PluginConfiguration) => clipanion

  .command(`policies set-resolution <descriptor> <resolution> [-s,--save]`)
  .describe(`enforce a package resolution`)

  .detail(`
    This command updates the resolution table so that \`descriptor\` is resolved by \`resolution\`.

    Note that by default this command only affect the current resolution table - meaning that this "manual override" will disappear if you remove the lockfile, or if the package disappear from the table. If you wish to make the enforced resolution persist whatever happens, add the \`-s,--save\` flag which will also edit the \`resolutions\` field from your top-level manifest.

    Note that no attempt is made at validating that \`resolution\` is a valid resolution entry for \`descriptor\`.
  `)

  .example(
    `Force all instances of lodash@^1.2.3 to resolve to 1.5.0`,
    `yarn set resolution lodash@^1.2.3 1.5.0`,
  )

  .action(async ({cwd, stdout, descriptor: fromDescriptorRaw, resolution: toRange, save}: {cwd: string, stdout: Writable, descriptor: string, resolution: string, save: boolean}) => {
    const configuration = await Configuration.find(cwd, pluginConfiguration);
    const {project, workspace} = await Project.find(configuration, cwd);
    const cache = await Cache.find(configuration);
  
    if (!workspace)
      throw new WorkspaceRequiredError(cwd);

    const fromDescriptor = structUtils.parseDescriptor(fromDescriptorRaw, true);
    const toDescriptor = structUtils.makeDescriptor(fromDescriptor, toRange);

    project.storedDescriptors.set(fromDescriptor.descriptorHash, fromDescriptor);
    project.storedDescriptors.set(toDescriptor.descriptorHash, toDescriptor);

    project.resolutionAliases.set(fromDescriptor.descriptorHash, toDescriptor.descriptorHash);

    const report = await StreamReport.start({configuration, stdout}, async (report: StreamReport) => {
      await project.install({cache, report});
    });

    return report.exitCode();
  });
