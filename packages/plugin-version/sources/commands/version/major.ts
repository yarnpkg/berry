import {WorkspaceRequiredError}                      from '@berry/cli';
import {Configuration, PluginConfiguration, Project} from '@berry/core';
import {PortablePath}                                from '@berry/fslib';

import * as versionUtils                             from '../../versionUtils';

// eslint-disable-next-line arca/no-default-export
export default (clipanion: any, pluginConfiguration: PluginConfiguration) => clipanion

  .command(`version major`)
  .categorize(`Release-related commands`)
  .describe(`bump the major number at the next release`)

  .detail(`
    This command will instruct Yarn to bump the major number (ie \`X.0.0\`) the next time you'll apply the version changes via \`yarn version apply\`.

    Note that contrary to its effect in Yarn v1, the effect isn't actually applied until you explicitly say so. For this reason calling the command twice is safe and won't bump your package by two different major numbers.

    Calling \`yarn version major\` will invalid any previous call to \`yarn version minor\` and \`yarn version patch\` (the highest bump takes precedence).
  `)

  .example(
    `Prepare the major number for a bump`,
    `yarn version major`,
  )

  .action(async ({cwd}: {cwd: PortablePath}) => {
    const configuration = await Configuration.find(cwd, pluginConfiguration);
    const {workspace} = await Project.find(configuration, cwd);

    if (!workspace)
      throw new WorkspaceRequiredError(cwd);

    await versionUtils.registerNextVersion(workspace, `major`);
    await workspace.persistManifest();
  });
