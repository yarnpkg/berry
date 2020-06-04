import {Cache, DescriptorHash, Descriptor, Ident, Locator, Manifest, Project, ThrowReport, Workspace} from '@yarnpkg/core';
import {structUtils}                                                                                  from '@yarnpkg/core';
import {ppath, PortablePath}                                                                          from '@yarnpkg/fslib';
import semver                                                                                         from 'semver';

export type Suggestion = {
  descriptor: Descriptor,
  reason: string,
};

export enum Target {
  REGULAR = `dependencies`,
  DEVELOPMENT = `devDependencies`,
  PEER = `peerDependencies`,
}

export enum Modifier {
  CARET = `^`,
  TILDE = `~`,
  EXACT = ``,
}

export enum Strategy {
  /**
   * If set, the suggest engine will offer to keep the current version if the
   * local workspace already depends on it.
   */
  KEEP = `keep`,

  /**
   * If set, the suggest engine will offer to fulfill the request by looking at
   * the ranges currently used by the other workspaces in the project.
   */
  REUSE = `reuse`,

  /**
   * If set, the suggest engine will offer to fulfill the request by using any
   * workspace whose name would match the request.
   */
  PROJECT = `project`,

  /**
   * If set, the suggest engine will offer to fulfill the request by using
   * whatever `<request-name>@latest` would return.
   */
  LATEST = `latest`,

  /**
   * If set, the suggest engine will offer to fulfill the request based on the
   * versions of the package that are already within our cache.
   */
  CACHE = `cache`,
}

export function getModifier(flags: {exact: boolean; caret: boolean; tilde: boolean}, project: Project): Modifier {
  if (flags.exact)
    return Modifier.EXACT;
  if (flags.caret)
    return Modifier.CARET;
  if (flags.tilde)
    return Modifier.TILDE;
  return project.configuration.get<Modifier>(`defaultSemverRangePrefix`);
}

const SIMPLE_SEMVER = /^([\^~]?)[0-9]+(?:\.[0-9]+){0,2}(?:-\S+)?$/;

export function extractRangeModifier(range: string, {project}: {project: Project}) {
  const match = range.match(SIMPLE_SEMVER);

  return match ? match[1] : project.configuration.get<Modifier>(`defaultSemverRangePrefix`);
}

export function applyModifier(descriptor: Descriptor, modifier: Modifier) {
  let {protocol, source, params, selector} = structUtils.parseRange(descriptor.range);

  if (semver.valid(selector))
    selector = `${modifier}${descriptor.range}`;

  return structUtils.makeDescriptor(descriptor, structUtils.makeRange({protocol, source, params, selector}));
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

export async function extractDescriptorFromPath(path: PortablePath, {cache, cwd, workspace}: {cache: Cache, cwd: PortablePath, workspace: Workspace}) {
  if (!ppath.isAbsolute(path))
    path = ppath.resolve(cwd, path);

  const project = workspace.project;

  const descriptor = await fetchDescriptorFrom(structUtils.makeIdent(null, `archive`), path, {project: workspace.project, cache});
  if (!descriptor)
    throw new Error(`Assertion failed: The descriptor should have been found`);

  const report = new ThrowReport();

  const resolver = project.configuration.makeResolver();
  const fetcher = project.configuration.makeFetcher();

  const resolverOptions = {checksums: project.storedChecksums, project, cache, fetcher, report, resolver};

  // While not useful since it's an absolute path, descriptor always have to be bound before being sent to the fetchers
  const boundDescriptor = resolver.bindDescriptor(descriptor, workspace.anchoredLocator, resolverOptions);

  // Since it's a file, we assume the returned descriptor is a valid locator
  const locator = structUtils.convertDescriptorToLocator(boundDescriptor);

  const fetchResult = await fetcher.fetch(locator, resolverOptions);
  const manifest = await Manifest.find(fetchResult.prefixPath, {baseFs: fetchResult.packageFs});

  if (!manifest.name)
    throw new Error(`Target path doesn't have a name`);

  return structUtils.makeDescriptor(manifest.name, path);
}

export async function getSuggestedDescriptors(request: Descriptor, {project, workspace, cache, target, modifier, strategies, maxResults = Infinity}: {project: Project, workspace: Workspace, cache: Cache, target: Target, modifier: Modifier, strategies: Array<Strategy>, maxResults?: number}) {
  if (!(maxResults >= 0))
    throw new Error(`Invalid maxResults (${maxResults})`);

  if (request.range !== `unknown`) {
    return [{
      descriptor: request,
      reason: `Unambiguous explicit request`,
    }];
  }

  const existing = typeof workspace !== `undefined` && workspace !== null
    ? workspace.manifest[target].get(request.identHash) || null
    : null;

  const suggested = [];

  for (const strategy of strategies) {
    if (suggested.length >= maxResults)
      break;

    switch (strategy) {
      case Strategy.KEEP: {
        if (existing) {
          const reason = `Keep ${structUtils.prettyDescriptor(project.configuration, existing)} (no changes)`;
          suggested.push({descriptor: existing, reason});
        }
      } break;

      case Strategy.REUSE: {
        for (const {descriptor, locators} of (await findProjectDescriptors(request, {project, target})).values()) {
          // We don't print the "reuse" key for the current workspace if the KEEP strategy is set since that would be redundant
          if (locators.length === 1 && locators[0].locatorHash === workspace.anchoredLocator.locatorHash)
            if (strategies.includes(Strategy.KEEP))
              continue;

          let reason = `Reuse ${structUtils.prettyDescriptor(project.configuration, descriptor)} (originally used by ${structUtils.prettyLocator(project.configuration, locators[0])}`;

          reason += locators.length > 1
            ? ` and ${locators.length - 1} other${locators.length > 2 ? `s` : ``})`
            : `)`;

          suggested.push({descriptor, reason});
        }
      } break;

      case Strategy.CACHE: {
        for (const descriptor of project.storedDescriptors.values()) {
          if (descriptor.identHash === request.identHash) {
            const reason = `Reuse ${structUtils.prettyDescriptor(project.configuration, descriptor)} (already used somewhere in the lockfile)`;
            suggested.push({descriptor, reason});
          }
        }
      } break;

      case Strategy.PROJECT: {
        // Don't suggest a workspace to depend on itself
        if (workspace.manifest.name !== null && request.identHash === workspace.manifest.name.identHash)
          continue;

        const candidateWorkspace = project.tryWorkspaceByIdent(request);
        if (candidateWorkspace === null)
          continue;

        const reason = `Attach ${structUtils.prettyWorkspace(project.configuration, candidateWorkspace)} (local workspace at ${candidateWorkspace.cwd})`;
        suggested.push({descriptor: candidateWorkspace.anchoredDescriptor, reason});
      } break;

      case Strategy.LATEST: {
        if (request.range !== `unknown`) {
          const reason = `Use ${structUtils.prettyRange(project.configuration, request.range)} (explicit range requested)`;
          suggested.push({descriptor: request, reason});
        } else if (target === Target.PEER) {
          const reason = `Use * (catch-all peer dependency pattern)`;
          suggested.push({descriptor: structUtils.makeDescriptor(request, `*`), reason});
        } else if (!project.configuration.get(`enableNetwork`)) {
          const reason = `Resolve from latest ${project.configuration.format(`(unavailable because enableNetwork is toggled off)`, `grey`)}`;
          suggested.push({descriptor: null, reason});
        } else {
          let latest;
          try {
            latest = await fetchDescriptorFrom(request, `latest`, {project, cache, preserveModifier: false});
          } catch {
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

export async function fetchDescriptorFrom(ident: Ident, range: string, {project, cache, preserveModifier = true}: {project: Project, cache: Cache, preserveModifier?: boolean | string}) {
  const latestDescriptor = structUtils.makeDescriptor(ident, range);

  const report = new ThrowReport();

  const fetcher = project.configuration.makeFetcher();
  const resolver = project.configuration.makeResolver();

  const resolverOptions = {checksums: project.storedChecksums, project, cache, fetcher, report, resolver};

  let candidateLocators;
  try {
    candidateLocators = await resolver.getCandidates(latestDescriptor, new Map(), resolverOptions);
  } catch {
    return null;
  }

  if (candidateLocators.length === 0)
    return null;

  // Per the requirements exposed in Resolver.ts, the best is the first one
  const bestLocator = candidateLocators[0];

  let {protocol, source, params, selector} = structUtils.parseRange(structUtils.convertToManifestRange(bestLocator.reference));
  if (protocol === project.configuration.get(`defaultProtocol`))
    protocol = null;

  if (semver.valid(selector) && preserveModifier !== false) {
    const referenceRange = typeof preserveModifier === `string`
      ? preserveModifier
      : latestDescriptor.range;

    const modifier = extractRangeModifier(referenceRange, {project});
    selector = modifier + selector;
  }

  return structUtils.makeDescriptor(bestLocator, structUtils.makeRange({protocol, source, params, selector}));
}
