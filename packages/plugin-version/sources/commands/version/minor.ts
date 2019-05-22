import {WorkspaceRequiredError}                      from '@berry/cli';
import {Configuration, PluginConfiguration, Project} from '@berry/core';
import {PortablePath}                                from '@berry/fslib';

import * as versionUtils                             from '../../versionUtils';

// eslint-disable-next-line arca/no-default-export
export default (clipanion: any, pluginConfiguration: PluginConfiguration) => clipanion

  .command(`version minor`)
  .categorize(`Release-related commands`)
  .describe(`bump the minor number at the next release`)

  .detail(`
    This command will instruct Yarn to bump the minor release (ie \`0.X.0\`) the next time you'll apply the version changes via \`yarn version apply\`.

    Note that contrary to its effect in Yarn v1, the effect isn't actually applied until you explicitly say so. For this reason calling the command twice is safe and won't bump your package by two different minor numbers.

    Calling \`yarn version minor\` will invalid any previous call to \`yarn version patch\`, and won't have any effect if \`yarn version major\` was called before (the highest bump takes precedence).
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

    await versionUtils.registerNextVersion(workspace, `minor`);
    await workspace.persistManifest();
  });
