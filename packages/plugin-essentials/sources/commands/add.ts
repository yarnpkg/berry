import {Configuration, Cache, Plugin, Project, StreamReport} from '@berry/core';
import {structUtils}                                         from '@berry/core';
import semver                                                from 'semver';
import {Writable}                                            from 'stream';

import {registerLegacyYarnResolutions}                       from '../utils/miscUtils';

export default (concierge: any, plugins: Map<string, Plugin>) => concierge

  .command(`add [... packages] [-E,--exact] [-T,--tilde] [-D,--dev] [-P,--peer]`)
  .describe(`add dependencies to the project`)

  .action(async ({cwd, stdout, packages, exact, tilde, dev, peer}: {cwd: string, stdout: Writable, packages: Array<string>, exact: boolean, tilde: boolean, dev: boolean, peer: boolean}) => {
    const configuration = await Configuration.find(cwd, plugins);
    const {project, workspace} = await Project.find(configuration, cwd);
    const cache = await Cache.find(configuration);

    const report = await StreamReport.start({configuration, stdout}, async (report: StreamReport) => {
      await registerLegacyYarnResolutions(project);

      const resolver = configuration.makeResolver();
      const fetcher = configuration.makeFetcher();

      const resolverOptions = {checksums: project.storedChecksums, readOnly: false, project, cache, fetcher, report, resolver};

      const descriptors = await Promise.all(packages.map(async entry => {
        const descriptor = structUtils.parseDescriptor(entry);

        // If the range is specified, no need to generate it out of thin air
        if (descriptor.range !== `unknown`)
          return descriptor;

        const latestDescriptor = structUtils.makeDescriptor(descriptor, `latest`);

        let candidateLocators;
        try {
          candidateLocators = await resolver.getCandidates(latestDescriptor, resolverOptions);
        } catch (error) {
          error.message = `${structUtils.prettyDescriptor(configuration, descriptor)}: ${error.message}`;
          throw error;
        }

        if (candidateLocators.length === 0)
          throw new Error(`No candidate found for ${structUtils.prettyDescriptor(configuration, latestDescriptor)}`);

        const bestLocator = candidateLocators[candidateLocators.length - 1];
        const protocolIndex = bestLocator.reference.indexOf(`:`);

        const protocol = protocolIndex !== -1
          ? bestLocator.reference.slice(0, protocolIndex + 1)
          : null;

        const pathname = protocolIndex !== -1
          ? bestLocator.reference.slice(protocolIndex + 1)
          : bestLocator.reference;

        if (!semver.valid(pathname))
          return structUtils.convertLocatorToDescriptor(bestLocator);

        const newProtocol = protocol !== configuration.defaultProtocol
          ? protocol
          : null;

        const newPathname = exact
          ? pathname
          : tilde
            ? `~${pathname}`
            : `^${pathname}`;

        const newRange = newProtocol !== null
          ? `${newProtocol}${newPathname}`
          : `${newPathname}`;

        return structUtils.makeDescriptor(bestLocator, newRange);
      }));

      const target = dev
        ? `devDependencies`
        : peer
          ? `peerDependencies`
          : `dependencies`;

      for (const descriptor of descriptors)
        workspace.manifest[target].set(descriptor.identHash, descriptor);

      await project.install({cache, report});
      await project.persist();
    });

    return report.hasErrors() ? 1 : 0;
  });
