import semver = require('semver');

import {Configuration, Cache, Project, Report} from '@berry/core';
import {structUtils}                           from '@berry/core';
import {NodeFS}                                from '@berry/zipfs';
import {Writable}                              from 'stream';

import {registerLegacyYarnResolutions}         from '../utils/miscUtils';

import {plugins}                               from '../plugins';

export default (concierge: any) => concierge

  .command(`add [... packages] [-E,--exact] [-T,--tilde] [-D,--dev] [-P,--peer]`)
  .describe(`add dependencies to the project`)

  .action(async ({cwd, stdout, packages, exact, tilde, dev, peer}: {cwd: string, stdout: Writable, packages: Array<string>, exact: boolean, tilde: boolean, dev: boolean, peer: boolean}) => {
    const configuration = await Configuration.find(cwd, plugins);
    const {project, workspace} = await Project.find(configuration, cwd);
    const cache = await Cache.find(configuration);

    const report = await Report.start({project, cache}, async () => {
      await registerLegacyYarnResolutions(project);

      const resolver = configuration.makeResolver({useLockfile: false});
      const fetcher = configuration.makeFetcher();

      const resolverOptions = {readOnly: false, rootFs: new NodeFS(), project, cache, fetcher, resolver};

      const descriptors = await Promise.all(packages.map(async entry => {
        const descriptor = structUtils.parseDescriptor(entry);

        if (descriptor.range !== `unknown`)
          return descriptor;

        const latestDescriptor = structUtils.makeDescriptor(descriptor, `latest`);

        let candidateReferences;

        try {
          candidateReferences = await resolver.getCandidates(latestDescriptor, resolverOptions);
        } catch (error) {
          error.message = `${structUtils.prettyDescriptor(configuration, descriptor)}: ${error.message}`;
          throw error;
        }

        if (candidateReferences.length === 0)
          throw new Error(`No candidate found for ${structUtils.prettyDescriptor(configuration, latestDescriptor)}`);

        const bestReference = candidateReferences[candidateReferences.length - 1];

        if (!semver.valid(bestReference))
          return structUtils.makeDescriptor(latestDescriptor, bestReference);

        const prefix = exact ? `` : tilde ? `~` : `^`;

        return structUtils.makeDescriptor(latestDescriptor, `${prefix}${bestReference}`);
      }));

      const target = dev ? `devDependencies` : peer ? `peerDependencies` : `dependencies`;

      for (const descriptor of descriptors) {
        workspace.manifest[target] = new Map(Array.from(workspace.manifest[target].entries()).filter(([hash, other]) => {
          return !structUtils.areIdentsEqual(descriptor, other);
        }));

        workspace.manifest[target].set(descriptor.identHash, descriptor);
      }

      await project.install({cache});
      await project.persist();
    });

    stdout.write(report);

    return project.errors.length === 0 ? 0 : 1;
  });
