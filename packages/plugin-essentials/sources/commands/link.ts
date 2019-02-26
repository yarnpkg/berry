import {WorkspaceRequiredError}                                           from '@berry/cli';
import {Configuration, Cache, PluginConfiguration, Project, StreamReport} from '@berry/core';
import {structUtils}                                                      from '@berry/core';
import {xfs}                                                              from '@berry/fslib';
// @ts-ignore
import {UsageError}                                                       from '@manaflair/concierge';
import {posix}                                                            from 'path';
import {Writable}                                                         from 'stream';

export default (concierge: any, pluginConfiguration: PluginConfiguration) => concierge

  .command(`link [... packages]`)
  .describe(`connect local packages together`)

  .detail(`
    When used without arguments, this command will register the current workspace into a global store. This will have no effect on the workspace itself.

    When used with arguments, Yarn will add entries in the \`resolutions\` field from the project package.json for each package name passed in argument that can be matched with a workspace previously registered into the global store.

    This workflow makes it simpler to work with a local version of your libraries.
  `)

  .example(
    `Registers a local workspace for use in another application`,
    `yarn link`,
  )

  .example(
    `Configures the project to always use the local version of my-package`,
    `yarn link my-package`,
  )

  .action(async ({cwd, stdout, packages}: {cwd: string, stdout: Writable, packages: Array<string>}) => {
    const configuration = await Configuration.find(cwd, pluginConfiguration);
    const {project, workspace} = await Project.find(configuration, cwd);

    if (!workspace)
      throw new WorkspaceRequiredError(cwd);

    const globalFolder = configuration.get(`globalFolder`);

    const lstatePath = posix.resolve(globalFolder, `link-state.json`);
    const lstate = xfs.existsSync(lstatePath)
      ? JSON.parse(await xfs.readFilePromise(lstatePath, `utf8`))
      : {};

    if (packages.length === 0) {
      if (!workspace.manifest.name)
        throw new UsageError(`This command can only be run within a local package with a name`);
      
      for (const [key, path] of Object.entries(lstate))
        if (path === workspace.cwd)
          delete lstate[key];

      lstate[structUtils.stringifyIdent(workspace.manifest.name)] = workspace.cwd;

      await xfs.mkdirpPromise(posix.dirname(lstatePath));
      await xfs.changeFilePromise(lstatePath, JSON.stringify(lstate, Object.keys(lstate).sort(), 2));
    } else {
      const descriptors = packages.map(packageName => {
        if (!Object.prototype.hasOwnProperty.call(lstate, packageName)) {
          throw new UsageError(`Couldn't find a link registration for "${packageName}" (${lstate})`);
        } else {
          return structUtils.makeDescriptor(structUtils.parseIdent(packageName), `portal:${lstate[packageName]}`);
        }
      });

      const cache = await Cache.find(configuration);

      for (const descriptor of descriptors) {
        if (workspace.manifest.devDependencies.has(descriptor.identHash)) {
          workspace.manifest.devDependencies.set(descriptor.identHash, descriptor);
        } else {
          workspace.manifest.dependencies.set(descriptor.identHash, descriptor);
        }
      }

      const report = await StreamReport.start({configuration, stdout}, async (report: StreamReport) => {
        await project.install({cache, report});
      });

      return report.exitCode();
    }
  });
