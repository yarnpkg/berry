import {Cache, DescriptorHash, Descriptor, Ident, Locator, Project, ThrowReport} from '@berry/core';
import {structUtils}                                                             from '@berry/core';
import semver                                                                    from 'semver';

export type Suggestion = {
  descriptor: Descriptor,
  reason: string,
};

export enum Target {
  REGULAR = 'dependencies',
  DEVELOPMENT = 'devDependencies',
  PEER = 'peerDependencies',
};

export enum Modifier {
  CARET = '^',
  TILDE = '~',
  EXACT = '',
};

export enum Strategy {
  KEEP = 'keep',
  REUSE = 'reuse',
  PROJECT = 'project',
  LATEST = 'latest',
};

export function applyModifier(descriptor: Descriptor, modifier: Modifier) {
  let {protocol, source, selector} = structUtils.parseRange(descriptor.range);

  if (semver.valid(selector))
    selector = `${modifier}${descriptor.range}`;

  return structUtils.makeDescriptor(descriptor, structUtils.makeRange({protocol, source, selector}));
}

export async function findProjectDescriptors(ident: Ident, {project, target}: {project: Project, target: Target}) {
  const matches: Map<DescriptorHash, {
    descriptor: Descriptor,
    locators: Array<Locator>,
  }> = new Map();

  const getDescriptorEntry = (descriptor: Descriptor) => {
    let entry = matches.get(descriptor.descriptorHash);

    if (!entry) {
      matches.set(descriptor.descriptorHash, entry = {
        descriptor,
        locators: [],
      });
    }

    return entry;
  };

  for (const workspace of project.workspaces) {
    if (target === Target.PEER) {
      const peerDescriptor = workspace.manifest.peerDependencies.get(ident.identHash);

      if (peerDescriptor !== undefined) {
        getDescriptorEntry(peerDescriptor).locators.push(workspace.locator);
      }
    } else {
      const regularDescriptor = workspace.manifest.dependencies.get(ident.identHash);
      const developmentDescriptor = workspace.manifest.devDependencies.get(ident.identHash);

      if (target === Target.DEVELOPMENT) {
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

  return matches;
}

export async function getSuggestedDescriptors(request: Descriptor, previous: Descriptor | null, {project, cache, target, modifier, strategies, maxResults = Infinity}: {project: Project, cache: Cache, target: Target, modifier: Modifier, strategies: Array<Strategy>, maxResults?: number}) {
  if (!(maxResults >= 0))
    throw new Error(`Invalid maxResults (${maxResults})`);

  const suggested = [];

  for (const strategy of strategies) {
    if (suggested.length >= maxResults)
      break;

    switch (strategy) {
      case Strategy.KEEP: {
        if (previous) {
          const reason = `Keep ${structUtils.prettyDescriptor(project.configuration, previous)} (no changes)`;
          suggested.push({descriptor: previous, reason});
        }
      } break;

      case Strategy.REUSE: {
        for (const {descriptor, locators} of (await findProjectDescriptors(request, {project, target})).values()) {
          const reason = `Reuse ${structUtils.prettyDescriptor(project.configuration, descriptor)} (originally used by ${locators.map(locator => structUtils.prettyLocator(project.configuration, locator)).join(`, `)})`;
          suggested.push({descriptor, reason});
        }
      } break;

      case Strategy.PROJECT: {
        for (const workspace of project.workspacesByIdent.get(request.identHash) || []) {
          const reason = `Attach ${structUtils.prettyWorkspace(project.configuration, workspace)} (local workspace at ${workspace.cwd})`;

          if (workspace.manifest.version) {
            suggested.push({descriptor: workspace.anchoredDescriptor, reason});
          } else {
            suggested.push({descriptor: workspace.anchoredDescriptor, reason})
          }
        }
      } break;

      case Strategy.LATEST: {
        if (request.range !== `unknown`) {
          const reason = `Use ${structUtils.prettyRange(project.configuration, request.range)} (explicit range requested)`;
          suggested.push({descriptor: request, reason})
        } else if (target === Target.PEER) {
          const reason = `Use * (catch-all peer dependency pattern)`;
          suggested.push({descriptor: structUtils.makeDescriptor(request, `*`), reason})
        } else if (!project.configuration.get(`enableNetwork`)) {
          const reason = `Resolve from latest ${project.configuration.format(`(unavailable because enableNetwork is toggled off)`, `grey`)}`;
          suggested.push({descriptor: null, reason});
        } else {
          let latest;
          try {
            latest = await fetchDescriptorFromLatest(request, {project, cache});
          } catch (error) {
            // Just ignore errors
          }

          if (latest) {
            latest = applyModifier(latest, modifier);

            const reason = `Use ${structUtils.prettyDescriptor(project.configuration, latest)} (resolved from latest)`;
            suggested.push({descriptor: latest, reason});
          }
        }
      } break;
    }
  }

  return suggested.slice(0, maxResults);
}

export async function fetchDescriptorFromLatest(ident: Ident, {project, cache}: {project: Project, cache: Cache}) {
  const latestDescriptor = structUtils.makeDescriptor(ident, `latest`);

  const report = new ThrowReport();

  const fetcher = project.configuration.makeFetcher();
  const resolver = project.configuration.makeResolver();

  const resolverOptions = {checksums: project.storedChecksums, project, cache, fetcher, report, resolver};

  let candidateLocators;
  try {
    candidateLocators = await resolver.getCandidates(latestDescriptor, resolverOptions);
  } catch (error) {
    return null;
  }

  if (candidateLocators.length === 0)
    return null;

  // Per the requirements exposed in Resolver.ts, the best is the first one
  const bestLocator = candidateLocators[0];

  let {protocol, source, selector} = structUtils.parseRange(bestLocator.reference);
  if (protocol === project.configuration.get(`defaultProtocol`))
    protocol = null;

  return structUtils.makeDescriptor(bestLocator, structUtils.makeRange({protocol, source, selector}));
}
