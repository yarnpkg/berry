import {WorkspaceRequiredError}                           from '@berry/cli';
import {Configuration, Cache, Descriptor, DescriptorHash} from '@berry/core';
import {Ident, Locator, Plugin, Project, Resolver}        from '@berry/core';
import {ResolveOptions, StreamReport}                     from '@berry/core';
import {structUtils}                                      from '@berry/core';
// @ts-ignore
import {UsageError}                                       from '@manaflair/concierge';
import inquirer                                           from 'inquirer';
import semver                                             from 'semver';
import {Readable, Writable}                               from 'stream';

export default (concierge: any, plugins: Map<string, Plugin>) => concierge

  .command(`add [... packages] [-E,--exact] [-T,--tilde] [-D,--dev] [-P,--peer] [-i,--interactive]`)
  .describe(`add dependencies to the project`)

  .action(async ({cwd, stdin, stdout, packages, exact, tilde, dev, peer, interactive}: {cwd: string, stdin: Readable, stdout: Writable, packages: Array<string>, exact: boolean, tilde: boolean, dev: boolean, peer: boolean, interactive: boolean}) => {
    const configuration = await Configuration.find(cwd, plugins);
    const {project, workspace} = await Project.find(configuration, cwd);
    const cache = await Cache.find(configuration);

    if (!workspace)
      throw new WorkspaceRequiredError(cwd);

    // @ts-ignore
    const prompt = inquirer.createPromptModule({
      input: stdin,
      output: stdout,
    });

    const descriptors: Array<Descriptor> = [];
    const idents: Array<Ident> = [];

    let askedQuestions = false;

    for (const entry of packages) {
      const descriptor = structUtils.parseDescriptor(entry);

      // If the range is specified, no need to generate it out of thin air
      if (descriptor.range !== `unknown`) {
        descriptors.push(descriptor);
        continue;
      }
      
      if (interactive || (configuration.get(`preferInteractive`) && (stdout as any).isTTY)) {
        askedQuestions = true;

        const descriptorFromProject = await fetchDescriptorFromProject(descriptor, {project, dev, peer, prompt});

        if (descriptorFromProject) {
          descriptors.push(descriptorFromProject);
          continue;
        }
      }
      
      if (peer) {
        descriptors.push(structUtils.makeDescriptor(descriptor, `*`));
        continue;
      }

      idents.push(descriptor);
    }

    if (askedQuestions)
      process.stdout.write(`\n`);

    const report = await StreamReport.start({configuration, stdout}, async (report: StreamReport) => {
      const fetcher = project.configuration.makeFetcher();
      const resolver = project.configuration.makeResolver();
  
      const resolverOptions = {checksums: project.storedChecksums, readOnly: false, project, cache, fetcher, report, resolver};
    
      const finalDescriptorList = [
        ... descriptors,
        ... await Promise.all(idents.map(async ident => {
          return await fetchDescriptorFromLatest(ident, {project, resolver, resolverOptions, exact, tilde});
        })),
      ];
  
      const target = dev
        ? `devDependencies`
        : peer
          ? `peerDependencies`
          : `dependencies`;

      for (const descriptor of finalDescriptorList)
        workspace.manifest[target].set(descriptor.identHash, descriptor);

      await project.install({cache, report});
    });

    return report.hasErrors() ? 1 : 0;
  });

async function fetchDescriptorFromProject(ident: Ident, {project, dev, peer, prompt}: {project: Project, dev: boolean, peer: boolean, prompt: any}) {
  const candidates: Map<DescriptorHash, {
    descriptor: Descriptor,
    locators: Array<Locator>,
  }> = new Map();

  const getDescriptorEntry = (descriptor: Descriptor) => {
    let entry = candidates.get(descriptor.descriptorHash);

    if (!entry) {
      candidates.set(descriptor.descriptorHash, entry = {
        descriptor,
        locators: [],
      });
    }

    return entry;
  };

  for (const workspace of project.workspaces) {
    if (peer) {
      const peerDescriptor = workspace.manifest.peerDependencies.get(ident.identHash);

      if (peerDescriptor !== undefined) {
        getDescriptorEntry(peerDescriptor).locators.push(workspace.locator);
      }
    } else {
      const regularDescriptor = workspace.manifest.dependencies.get(ident.identHash);
      const developmentDescriptor = workspace.manifest.devDependencies.get(ident.identHash);

      if (dev) {
        if (developmentDescriptor !== undefined) {
          getDescriptorEntry(developmentDescriptor).locators.push(workspace.locator);
        } else if (regularDescriptor !== undefined) {
          getDescriptorEntry(regularDescriptor).locators.push(workspace.locator);
        }
      } else {
        if (regularDescriptor !== undefined) {
          getDescriptorEntry(regularDescriptor).locators.push(workspace.locator);
        } else if (developmentDescriptor !== undefined) {
          getDescriptorEntry(developmentDescriptor).locators.push(workspace.locator);
        }
      }
    }
  }

  const result = await prompt({
    type: `list`,
    name: `answer`,
    message: `Which range to you want to use?`,
    choices: Array.from(candidates.values()).map(({descriptor, locators}) => {
      return {
        name: `Reuse ${structUtils.prettyDescriptor(project.configuration, descriptor)} (originally used by ${locators.map(locator => structUtils.prettyLocator(project.configuration, locator)).join(`, `)})`,
        value: descriptor as Descriptor | null,
        short: structUtils.prettyDescriptor(project.configuration, descriptor),
      };
    }).concat([{
      name: `Resolve from latest`,
      value: null,
      short: `latest`,
    }]),
  });

  if (result.answer) {
    return result.answer as Descriptor;
  } else {
    return null;
  }
}

async function fetchDescriptorFromLatest(ident: Ident, {project, resolver, resolverOptions, exact, tilde}: {project: Project, resolver: Resolver, resolverOptions: ResolveOptions, exact: boolean, tilde: boolean}) {
  const latestDescriptor = structUtils.makeDescriptor(ident, `latest`);

  let candidateLocators;
  try {
    candidateLocators = await resolver.getCandidates(latestDescriptor, resolverOptions);
  } catch (error) {
    error.message = `${structUtils.prettyDescriptor(project.configuration, latestDescriptor)}: ${error.message}`;
    throw error;
  }

  if (candidateLocators.length === 0)
    throw new Error(`No candidate found for ${structUtils.prettyDescriptor(project.configuration, latestDescriptor)}`);

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

  const newProtocol = protocol !== project.configuration.get(`defaultProtocol`)
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
}