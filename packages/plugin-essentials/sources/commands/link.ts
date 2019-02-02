import {Configuration, Cache, Plugin, Project, StreamReport} from '@berry/core';
import {structUtils}                                         from '@berry/core';
import {xfs}                                                 from '@berry/fslib';
// @ts-ignore
import {UsageError}                                          from '@manaflair/concierge';
import {posix}                                               from 'path';
import {Writable}                                            from 'stream';

import {registerLegacyYarnResolutions}                       from '../utils/miscUtils';

export default (concierge: any, plugins: Map<string, Plugin>) => concierge

  .command(`link [... packages]`)
  .describe(`connect local packages together`)

  .action(async ({cwd, stdout, packages}: {cwd: string, stdout: Writable, packages: Array<string>}) => {
    const configuration = await Configuration.find(cwd, plugins);
    const {project, workspace} = await Project.find(configuration, cwd);

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

      const report = await StreamReport.start({configuration, stdout}, async (report: StreamReport) => {
        await registerLegacyYarnResolutions(project);

        for (const descriptor of descriptors) {
          if (workspace.manifest.devDependencies.has(descriptor.identHash)) {
            workspace.manifest.devDependencies.set(descriptor.identHash, descriptor);
          } else {
            workspace.manifest.dependencies.set(descriptor.identHash, descriptor);
          }
        }

        await project.install({cache, report});
        await project.persist();
      });

      return report.hasErrors() ? 1 : 0;
    }
  });
