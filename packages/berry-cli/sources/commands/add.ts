import semver = require('semver');

import {Configuration, Cache, Project, Report} from '@berry/core';
import {structUtils}                           from '@berry/core';
import {Writable}                              from 'stream';

import {plugins}                               from '../plugins';

export default (concierge: any) => concierge

  .command(`add [... packages]`)
  .describe(`add dependencies to the project`)

  .action(async ({cwd, stdout, packages}: {cwd: string, stdout: Writable, packages: Array<string>}) => {
    const configuration = await Configuration.find(cwd, plugins);
    const {project, workspace} = await Project.find(configuration, cwd);
    const cache = await Cache.find(configuration);

    const report = await Report.start({project, cache}, async () => {
      const resolver = configuration.makeResolver({useLockfile: false});
      const fetcher = configuration.makeFetcher();

      const descriptors = await Promise.all(packages.map(async entry => {
        const descriptor = structUtils.parseDescriptor(entry);

        if (descriptor.range !== `unknown`)
          return descriptor;

        const latestDescriptor = structUtils.makeDescriptor(descriptor, `latest`);

        let candidateReferences;

        try {
          candidateReferences = await resolver.getCandidates(latestDescriptor, {project, cache, fetcher, resolver});
        } catch (error) {
          error.message = `${structUtils.prettyDescriptor(configuration, descriptor)}: ${error.message}`;
          throw error;
        }

        if (candidateReferences.length === 0)
          throw new Error(`No candidate found for ${structUtils.prettyDescriptor(configuration, latestDescriptor)}`);

        const bestReference = candidateReferences[candidateReferences.length - 1];

        if (!semver.valid(bestReference))
          return structUtils.makeDescriptor(latestDescriptor, bestReference);

        const prefix = `^`;

        return structUtils.makeDescriptor(latestDescriptor, `${prefix}${bestReference}`);
      }));

      for (const descriptor of descriptors)
        workspace.manifest.dependencies.set(descriptor.identHash, descriptor);

      await project.install({cache});
      await project.persist();
    });

    stdout.write(report);

    return project.errors.length === 0 ? 0 : 1;
  });
