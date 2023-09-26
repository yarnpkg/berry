import {Cache, DescriptorHash, Descriptor, Ident, Locator, Manifest, Project, ThrowReport, Workspace, FetchOptions, ResolveOptions, Configuration} from '@yarnpkg/core';
import {formatUtils, structUtils, semverUtils}                                                                                                     from '@yarnpkg/core';
import {PortablePath, ppath, xfs}                                                                                                                  from '@yarnpkg/fslib';
import semver                                                                                                                                      from 'semver';

const WORKSPACE_PROTOCOL = `workspace:`;

export type Suggestion = {
  descriptor: Descriptor;
  name: string;
  reason: string;
};

export type NullableSuggestion = {
  descriptor: Descriptor | null;
  name: string;
  reason: string;
};

export type Results = {
  suggestions: Array<NullableSuggestion>;
  rejections: Array<Error>;
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

export enum WorkspaceModifier {
  CARET = `^`,
  TILDE = `~`,
  EXACT = `*`,
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

export function getModifier(flags: {exact: boolean, caret: boolean, tilde: boolean}, project: Project): Modifier {
  if (flags.exact)
    return Modifier.EXACT;
  if (flags.caret)
    return Modifier.CARET;
  if (flags.tilde)
    return Modifier.TILDE;
  return project.configuration.get(`defaultSemverRangePrefix`) as Modifier;
}

const SIMPLE_SEMVER = /^([\^~]?)[0-9]+(?:\.[0-9]+){0,2}(?:-\S+)?$/;

export function extractRangeModifier(range: string, {project}: {project: Project}) {
  const match = range.match(SIMPLE_SEMVER);

  return match ? match[1] : project.configuration.get(`defaultSemverRangePrefix`);
}

export function applyModifier(descriptor: Descriptor, modifier: Modifier) {
  let {protocol, source, params, selector} = structUtils.parseRange(descriptor.range);

  if (semver.valid(selector))
    selector = `${modifier}${descriptor.range}`;

  return structUtils.makeDescriptor(descriptor, structUtils.makeRange({protocol, source, params, selector}));
}

export function toWorkspaceModifier(modifier: Modifier): WorkspaceModifier {
  switch (modifier) {
    case Modifier.CARET:
      return WorkspaceModifier.CARET;
    case Modifier.TILDE:
      return WorkspaceModifier.TILDE;
    case Modifier.EXACT:
      return WorkspaceModifier.EXACT;
    default:
      throw new Error(`Assertion failed: Unknown modifier: "${modifier}"`);
  }
}

export function makeWorkspaceDescriptor(workspace: Workspace, modifier: Modifier) {
  return structUtils.makeDescriptor(workspace.anchoredDescriptor, `${WORKSPACE_PROTOCOL}${toWorkspaceModifier(modifier)}`);
}

export async function findProjectDescriptors(ident: Ident, {project, target}: {project: Project, target: Target}) {
  const matches: Map<DescriptorHash, {
    descriptor: Descriptor;
    locators: Array<Locator>;
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
        getDescriptorEntry(peerDescriptor).locators.push(workspace.anchoredLocator);
      }
    } else {
      const regularDescriptor = workspace.manifest.dependencies.get(ident.identHash);
      const developmentDescriptor = workspace.manifest.devDependencies.get(ident.identHash);

      if (target === Target.DEVELOPMENT) {
        if (developmentDescriptor !== undefined) {
          getDescriptorEntry(developmentDescriptor).locators.push(workspace.anchoredLocator);
        } else if (regularDescriptor !== undefined) {
          getDescriptorEntry(regularDescriptor).locators.push(workspace.anchoredLocator);
        }
      } else {
        if (regularDescriptor !== undefined) {
          getDescriptorEntry(regularDescriptor).locators.push(workspace.anchoredLocator);
        } else if (developmentDescriptor !== undefined) {
          getDescriptorEntry(developmentDescriptor).locators.push(workspace.anchoredLocator);
        }
      }
    }
  }

  return matches;
}

export async function extractDescriptorFromPath(path: PortablePath, {cwd, workspace}: {cwd: PortablePath, workspace: Workspace}) {
  // We use a temporary cache so that we don't pollute the project cache with temporary archives
  return await makeTemporaryCache(async cache => {
    if (!ppath.isAbsolute(path)) {
      path = ppath.relative(workspace.cwd, ppath.resolve(cwd, path));
      if (!path.match(/^\.{0,2}\//)) {
        path = `./${path}` as PortablePath;
      }
    }

    const {project} = workspace;

    const descriptor = await fetchDescriptorFrom(structUtils.makeIdent(null, `archive`), path, {project: workspace.project, cache, workspace});
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
  });
}

export async function getSuggestedDescriptors(request: Descriptor, {project, workspace, cache, target, fixed, modifier, strategies, maxResults = Infinity}: {project: Project, workspace: Workspace, cache: Cache, target: Target, fixed: boolean, modifier: Modifier, strategies: Array<Strategy>, maxResults?: number}): Promise<Results> {
  if (!(maxResults >= 0))
    throw new Error(`Invalid maxResults (${maxResults})`);

  const [requestRange, requestTag] = request.range !== `unknown`
    ? fixed || semverUtils.validRange(request.range) || !request.range.match(/^[a-z0-9._-]+$/i)
      ? [request.range, `latest`]
      : [`unknown`, request.range]
    : [`unknown`, `latest`];

  if (requestRange !== `unknown`) {
    return {
      suggestions: [{
        descriptor: request,
        name: `Use ${structUtils.prettyDescriptor(project.configuration, request)}`,
        reason: `(unambiguous explicit request)`,
      }],
      rejections: [],
    };
  }

  const existing = typeof workspace !== `undefined` && workspace !== null
    ? workspace.manifest[target].get(request.identHash) || null
    : null;

  const suggested: Array<NullableSuggestion> = [];

  const rejected: Array<Error> = [];
  const trySuggest = async (cb: () => Promise<void>) => {
    try {
      await cb();
    } catch (e) {
      rejected.push(e);
    }
  };

  for (const strategy of strategies) {
    if (suggested.length >= maxResults)
      break;

    switch (strategy) {
      case Strategy.KEEP: {
        await trySuggest(async () => {
          if (existing) {
            suggested.push({
              descriptor: existing,
              name: `Keep ${structUtils.prettyDescriptor(project.configuration, existing)}`,
              reason: `(no changes)`,
            });
          }
        });
      } break;

      case Strategy.REUSE: {
        await trySuggest(async () => {
          for (const {descriptor, locators} of (await findProjectDescriptors(request, {project, target})).values()) {
            // We don't print the "reuse" key for the current workspace if the KEEP strategy is set since that would be redundant
            if (locators.length === 1 && locators[0].locatorHash === workspace.anchoredLocator.locatorHash)
              if (strategies.includes(Strategy.KEEP))
                continue;

            let reason = `(originally used by ${structUtils.prettyLocator(project.configuration, locators[0])}`;

            reason += locators.length > 1
              ? ` and ${locators.length - 1} other${locators.length > 2 ? `s` : ``})`
              : `)`;

            suggested.push({
              descriptor,
              name: `Reuse ${structUtils.prettyDescriptor(project.configuration, descriptor)}`,
              reason,
            });
          }
        });
      } break;

      case Strategy.CACHE: {
        await trySuggest(async () => {
          for (const descriptor of project.storedDescriptors.values()) {
            if (descriptor.identHash === request.identHash) {
              suggested.push({
                descriptor,
                name: `Reuse ${structUtils.prettyDescriptor(project.configuration, descriptor)}`,
                reason: `(already used somewhere in the lockfile)`,
              });
            }
          }
        });
      } break;

      case Strategy.PROJECT: {
        await trySuggest(async () => {
          // Don't suggest a workspace to depend on itself
          if (workspace.manifest.name !== null && request.identHash === workspace.manifest.name.identHash)
            return;

          const candidateWorkspace = project.tryWorkspaceByIdent(request);
          if (candidateWorkspace === null)
            return;

          const workspaceDescriptor = makeWorkspaceDescriptor(candidateWorkspace, modifier);

          suggested.push({
            descriptor: workspaceDescriptor,
            name: `Attach ${structUtils.prettyDescriptor(project.configuration, workspaceDescriptor)}`,
            reason: `(local workspace at ${formatUtils.pretty(project.configuration, candidateWorkspace.relativeCwd, formatUtils.Type.PATH)})`,
          });
        });
      } break;

      case Strategy.LATEST: {
        const hasNetwork = project.configuration.get(`enableNetwork`);
        const isOfflineMode = project.configuration.get(`enableOfflineMode`);

        await trySuggest(async () => {
          if (target === Target.PEER) {
            suggested.push({
              descriptor: structUtils.makeDescriptor(request, `*`),
              name: `Use *`,
              reason: `(catch-all peer dependency pattern)`,
            });
          } else if (!hasNetwork && !isOfflineMode) {
            suggested.push({
              descriptor: null,
              name: `Resolve from latest`,
              reason: formatUtils.pretty(project.configuration, `(unavailable because enableNetwork is toggled off)`, `grey`),
            });
          } else {
            const latest = await fetchDescriptorFrom(request, requestTag, {project, cache, workspace, modifier});
            if (latest) {
              suggested.push({
                descriptor: latest,
                name: `Use ${structUtils.prettyDescriptor(project.configuration, latest)}`,
                reason: `(resolved from ${isOfflineMode ? `the cache` : `latest`})`,
              });
            }
          }
        });
      } break;
    }
  }

  return {
    suggestions: suggested.slice(0, maxResults),
    rejections: rejected.slice(0, maxResults),
  };
}

export type FetchDescriptorFromOptions = {
  project: Project;
  cache: Cache;
  workspace: Workspace;
} & ({
  preserveModifier?: boolean | string;
  modifier?: undefined;
} | {
  preserveModifier?: undefined;
  modifier: Modifier;
});

export async function fetchDescriptorFrom(ident: Ident, range: string, {project, cache, workspace, preserveModifier = true, modifier}: FetchDescriptorFromOptions) {
  const latestDescriptor = project.configuration.normalizeDependency(structUtils.makeDescriptor(ident, range));

  const report = new ThrowReport();

  const fetcher = project.configuration.makeFetcher();
  const resolver = project.configuration.makeResolver();

  const fetchOptions: FetchOptions = {project, fetcher, cache, checksums: project.storedChecksums, report, cacheOptions: {skipIntegrityCheck: true}};
  const resolveOptions: ResolveOptions = {...fetchOptions, resolver, fetchOptions};

  // The descriptor has to be bound for the resolvers that need a parent locator. (e.g. FileResolver)
  // If we didn't bind it, `yarn add ./folder` wouldn't work.
  const boundDescriptor = resolver.bindDescriptor(latestDescriptor, workspace.anchoredLocator, resolveOptions);

  const candidateLocators = await resolver.getCandidates(boundDescriptor, {}, resolveOptions);
  if (candidateLocators.length === 0)
    return null;

  // Per the requirements exposed in Resolver.ts, the best is the first one
  const bestLocator = candidateLocators[0];

  let {protocol, source, params, selector} = structUtils.parseRange(structUtils.convertToManifestRange(bestLocator.reference));
  if (protocol === project.configuration.get(`defaultProtocol`))
    protocol = null;

  if (semver.valid(selector)) {
    const rawSelector = selector;

    if (typeof modifier !== `undefined`) {
      selector = modifier + selector;
    } else if (preserveModifier !== false) {
      const referenceRange = typeof preserveModifier === `string`
        ? preserveModifier
        : latestDescriptor.range;

      const modifier = extractRangeModifier(referenceRange, {project});
      selector = modifier + selector;
    }

    const screeningDescriptor = structUtils.makeDescriptor(bestLocator, structUtils.makeRange({protocol, source, params, selector}));
    const screeningLocators = await resolver.getCandidates(project.configuration.normalizeDependency(screeningDescriptor), {}, resolveOptions);

    // If turning 1.0.0 into ^1.0.0 would cause it to resolve to something else
    // (for example 1.1.0), then we don't add the modifier.
    //
    // This is to account for "weird" release strategies where things like
    // prereleases are released as older versions than the latest available
    // ones.
    //
    // Ex 1: https://github.com/parcel-bundler/parcel/issues/8010
    // Ex 2: https://github.com/sveltejs/kit/discussions/4645
    if (screeningLocators.length !== 1) {
      selector = rawSelector;
    }
  }

  return structUtils.makeDescriptor(bestLocator, structUtils.makeRange({protocol, source, params, selector}));
}

async function makeTemporaryCache<T>(cb: (cache: Cache) => Promise<T>) {
  return await xfs.mktempPromise(async cacheDir => {
    const configuration = Configuration.create(cacheDir);

    configuration.useWithSource(cacheDir, {
      // Don't pollute the mirror with temporary archives
      enableMirror: false,
      // Don't spend time compressing what gets deleted later
      compressionLevel: 0,
    }, cacheDir, {overwrite: true});

    return await cb(new Cache(cacheDir, {configuration, check: false, immutable: false}));
  });
}
