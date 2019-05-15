import {WorkspaceRequiredError}                                           from '@berry/cli';
import {Cache, Configuration, PluginConfiguration, Project, StreamReport} from '@berry/core';
import {structUtils}                                                      from '@berry/core';
import {Writable}                                                         from 'stream';
import { PortablePath } from '@berry/fslib';

// eslint-disable-next-line arca/no-default-export
export default (clipanion: any, pluginConfiguration: PluginConfiguration) => clipanion

  .command(`unplug [... patterns]`)
  .describe(`force the unpacking of a list of packages`)

  .detail(`
    This command will add the specified selectors to the list of packages that must be unplugged when installed.

    A package being unplugged means that instead of being referenced directly through its archive, it will be unpacked at install time in the directory configured via \`virtualFolder\`.

    Unpacking a package isn't advised as a general tool because it makes it harder to store your packages within the repository. However, it's a good approach to quickly and safely debug some packages, and can even sometimes be required depending on the context (for example when the package contains shellscripts).

    The unplug command sets a flag that's persisted in your top-level \`package.json\` through the \`dependenciesMeta\` field. As such, to undo its effects, just revert the changes made to the manifest and run \`yarn install\`.
  `)

  .example(
    `Unplug lodash`,
    `yarn unplug lodash`
  )

  .example(
    `Unplug one specific version of lodash`,
    `yarn unplug lodash@1.2.3`,
  )

  .action(async ({cwd, patterns, stdout}: {cwd: PortablePath, patterns: string, stdout: Writable}) => {
    const configuration = await Configuration.find(cwd, pluginConfiguration);
    const {project, workspace} = await Project.find(configuration, cwd);
    const cache = await Cache.find(configuration);

    if (!workspace)
      throw new WorkspaceRequiredError(cwd);

    const topLevelWorkspace = project.topLevelWorkspace;

    for (const pattern of patterns) {
      const descriptor = structUtils.parseDescriptor(pattern);
      const dependencyMeta = topLevelWorkspace.manifest.ensureDependencyMeta(descriptor);

      dependencyMeta.unplugged = true;0
    }

    await topLevelWorkspace.persistManifest();

    const report = await StreamReport.start({configuration, stdout}, async report => {
      await project.install({cache, report});
    });

    return report.exitCode();
  });
