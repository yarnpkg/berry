import {AllDependencies, miscUtils, hashUtils, Workspace, structUtils, Project, Manifest, IdentHash, Report, MessageName, WorkspaceResolver} from '@yarnpkg/core';
import {Filename, PortablePath, npath, ppath, xfs}                                                                                           from '@yarnpkg/fslib';
import {parseSyml, stringifySyml}                                                                                                            from '@yarnpkg/parsers';
import {gitUtils}                                                                                                                            from '@yarnpkg/plugin-git';
import {UsageError}                                                                                                                          from 'clipanion';
import omit                                                                                                                                  from 'lodash/omit';
import semver                                                                                                                                from 'semver';

/**
 * @deprecated Use `gitUtils.fetchBase` instead
 */
export const fetchBase = gitUtils.fetchBase;

/**
 * @deprecated Use `gitUtils.fetchRoot` instead
 */
export const fetchRoot = gitUtils.fetchRoot;

/**
 * @deprecated Use `gitUtils.fetchChangedFiles` instead
 */
export const fetchChangedFiles = gitUtils.fetchChangedFiles;

// Basically we only support auto-upgrading the ranges that are very simple (^x.y.z, ~x.y.z, >=x.y.z, and of course x.y.z)
const SUPPORTED_UPGRADE_REGEXP = /^(>=|[~^]|)(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-(0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(\.(0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*)?(\+[0-9a-zA-Z-]+(\.[0-9a-zA-Z-]+)*)?$/;

export enum Decision {
  UNDECIDED = `undecided`,
  DECLINE = `decline`,
  MAJOR = `major`,
  MINOR = `minor`,
  PATCH = `patch`,
  PRERELEASE = `prerelease`,
}

export type IncrementDecision = Exclude<Decision, Decision.UNDECIDED | Decision.DECLINE>;

export type Releases = Map<Workspace, string>;

export function validateReleaseDecision(decision: unknown): string {
  const semverDecision = semver.valid(decision as string);
  if (semverDecision)
    return semverDecision;

  return miscUtils.validateEnum(omit(Decision, `UNDECIDED`), decision as string);
}

export type VersionFile = {
  project: Project;

  changedFiles: Set<PortablePath>;
  changedWorkspaces: Set<Workspace>;

  releaseRoots: Set<Workspace>;
  releases: Releases;

  saveAll: () => Promise<void>;
} & ({
  root: PortablePath;

  baseHash: string;
  baseTitle: string;
} | {
  root: null;

  baseHash: null;
  baseTitle: null;
});

export async function resolveVersionFiles(project: Project, {prerelease = null}: {prerelease?: string | null} = {}) {
  let candidateReleases = new Map<Workspace, string>();

  const deferredVersionFolder = project.configuration.get(`deferredVersionFolder`);
  if (!xfs.existsSync(deferredVersionFolder))
    return new Map();

  const deferredVersionFiles = await xfs.readdirPromise(deferredVersionFolder);

  for (const entry of deferredVersionFiles) {
    if (!entry.endsWith(`.yml`))
      continue;

    const versionPath = ppath.join(deferredVersionFolder, entry);
    const versionContent = await xfs.readFilePromise(versionPath, `utf8`);
    const versionData = parseSyml(versionContent);

    for (const [identStr, decision] of Object.entries(versionData.releases || {})) {
      if (decision === Decision.DECLINE)
        continue;

      const ident = structUtils.parseIdent(identStr);

      const workspace = project.tryWorkspaceByIdent(ident);
      if (workspace === null)
        throw new Error(`Assertion failed: Expected a release definition file to only reference existing workspaces (${ppath.basename(versionPath)} references ${identStr})`);

      if (workspace.manifest.version === null)
        throw new Error(`Assertion failed: Expected the workspace to have a version (${structUtils.prettyLocator(project.configuration, workspace.anchoredLocator)})`);

      // If there's a `stableVersion` field, then we assume that `version`
      // contains a prerelease version and that we need to base the version
      // bump relative to the latest stable instead.
      const baseVersion = workspace.manifest.raw.stableVersion ?? workspace.manifest.version;

      const candidateRelease = candidateReleases.get(workspace);
      const suggestedRelease = applyStrategy(baseVersion, validateReleaseDecision(decision));

      if (suggestedRelease === null)
        throw new Error(`Assertion failed: Expected ${baseVersion} to support being bumped via strategy ${decision}`);

      const bestRelease = typeof candidateRelease !== `undefined`
        ? semver.gt(suggestedRelease, candidateRelease) ? suggestedRelease : candidateRelease
        : suggestedRelease;

      candidateReleases.set(workspace, bestRelease);
    }
  }

  if (prerelease) {
    candidateReleases = new Map([...candidateReleases].map(([workspace, release]) => {
      return [workspace, applyPrerelease(release, {current: workspace.manifest.version!, prerelease})];
    }));
  }

  return candidateReleases;
}

export async function clearVersionFiles(project: Project) {
  const deferredVersionFolder = project.configuration.get(`deferredVersionFolder`);
  if (!xfs.existsSync(deferredVersionFolder))
    return;

  await xfs.removePromise(deferredVersionFolder);
}

export async function updateVersionFiles(project: Project) {
  const deferredVersionFolder = project.configuration.get(`deferredVersionFolder`);
  if (!xfs.existsSync(deferredVersionFolder))
    return;

  const deferredVersionFiles = await xfs.readdirPromise(deferredVersionFolder);

  for (const entry of deferredVersionFiles) {
    if (!entry.endsWith(`.yml`))
      continue;

    const versionPath = ppath.join(deferredVersionFolder, entry);
    const versionContent = await xfs.readFilePromise(versionPath, `utf8`);
    const versionData = parseSyml(versionContent);

    const releases = versionData?.releases;
    if (!releases)
      continue;

    for (const locatorStr of Object.keys(releases)) {
      const locator = structUtils.parseLocator(locatorStr);
      const workspace = project.tryWorkspaceByLocator(locator);

      if (workspace === null) {
        delete versionData.releases[locatorStr];
      }
    }

    await xfs.changeFilePromise(versionPath, stringifySyml(
      new stringifySyml.PreserveOrdering(
        versionData,
      ),
    ));
  }
}

export async function openVersionFile(project: Project, opts: {allowEmpty: true}): Promise<VersionFile>;
export async function openVersionFile(project: Project, opts?: {allowEmpty?: boolean}): Promise<VersionFile | null>;
export async function openVersionFile(project: Project, {allowEmpty = false}: {allowEmpty?: boolean} = {}) {
  const configuration = project.configuration;
  if (configuration.projectCwd === null)
    throw new UsageError(`This command can only be run from within a Yarn project`);

  const root = await gitUtils.fetchRoot(configuration.projectCwd);

  const base = root !== null
    ? await gitUtils.fetchBase(root, {baseRefs: configuration.get(`changesetBaseRefs`)})
    : null;

  const changedFiles = root !== null
    ? await gitUtils.fetchChangedFiles(root, {base: base!.hash, project})
    : [];

  const deferredVersionFolder = configuration.get(`deferredVersionFolder`);
  const versionFiles = changedFiles.filter(p => ppath.contains(deferredVersionFolder, p) !== null);

  if (versionFiles.length > 1)
    throw new UsageError(`Your current branch contains multiple versioning files; this isn't supported:\n- ${versionFiles.map(file => npath.fromPortablePath(file)).join(`\n- `)}`);

  const changedWorkspaces: Set<Workspace> = new Set(miscUtils.mapAndFilter(changedFiles, file => {
    const workspace = project.tryWorkspaceByFilePath(file);
    if (workspace === null)
      return miscUtils.mapAndFilter.skip;

    return workspace;
  }));

  if (versionFiles.length === 0 && changedWorkspaces.size === 0 && !allowEmpty)
    return null;

  const versionPath = versionFiles.length === 1
    ? versionFiles[0]
    : ppath.join(deferredVersionFolder, `${hashUtils.makeHash(Math.random().toString()).slice(0, 8)}.yml` as Filename);

  const versionContent = xfs.existsSync(versionPath)
    ? await xfs.readFilePromise(versionPath, `utf8`)
    : `{}`;

  const versionData = parseSyml(versionContent);
  const releaseStore: Releases = new Map();

  for (const identStr of versionData.declined || []) {
    const ident = structUtils.parseIdent(identStr);
    const workspace = project.getWorkspaceByIdent(ident);

    releaseStore.set(workspace, Decision.DECLINE);
  }

  for (const [identStr, decision] of Object.entries(versionData.releases || {})) {
    const ident = structUtils.parseIdent(identStr);
    const workspace = project.getWorkspaceByIdent(ident);

    releaseStore.set(workspace, validateReleaseDecision(decision));
  }

  return {
    project,

    root,

    baseHash: base !== null
      ? base.hash
      : null,

    baseTitle: base !== null
      ? base.title
      : null,

    changedFiles: new Set(changedFiles),
    changedWorkspaces,

    releaseRoots: new Set([...changedWorkspaces].filter(workspace => workspace.manifest.version !== null)),
    releases: releaseStore,

    async saveAll() {
      const releases: {[key: string]: string} = {};
      const declined: Array<string> = [];
      const undecided: Array<string> = [];

      for (const workspace of project.workspaces) {
        // Let's assume that packages without versions don't need to see their version increased
        if (workspace.manifest.version === null)
          continue;

        const identStr = structUtils.stringifyIdent(workspace.locator);

        const decision = releaseStore.get(workspace);
        if (decision === Decision.DECLINE) {
          declined.push(identStr);
        } else if (typeof decision !== `undefined`) {
          releases[identStr] = validateReleaseDecision(decision);
        } else if (changedWorkspaces.has(workspace)) {
          undecided.push(identStr);
        }
      }

      await xfs.mkdirPromise(ppath.dirname(versionPath), {recursive: true});

      await xfs.changeFilePromise(versionPath, stringifySyml(
        new stringifySyml.PreserveOrdering({
          releases: Object.keys(releases).length > 0 ? releases : undefined,
          declined: declined.length > 0 ? declined : undefined,
          undecided: undecided.length > 0 ? undecided : undefined,
        }),
      ));
    },
  } as VersionFile;
}

export function requireMoreDecisions(versionFile: VersionFile) {
  if (getUndecidedWorkspaces(versionFile).size > 0)
    return true;

  if (getUndecidedDependentWorkspaces(versionFile).length > 0)
    return true;

  return false;
}

export function getUndecidedWorkspaces(versionFile: VersionFile) {
  const undecided = new Set<Workspace>();

  for (const workspace of versionFile.changedWorkspaces) {
    // Let's assume that packages without versions don't need to see their version increased
    if (workspace.manifest.version === null)
      continue;

    if (versionFile.releases.has(workspace))
      continue;

    undecided.add(workspace);
  }

  return undecided;
}

export function getUndecidedDependentWorkspaces(versionFile: Pick<VersionFile, 'project' | 'releases'>, {include = new Set()}: {include?: Set<Workspace>} = {}) {
  const undecided = [];

  const bumpedWorkspaces = new Map(miscUtils.mapAndFilter([...versionFile.releases], ([workspace, decision]) => {
    if (decision === Decision.DECLINE)
      return miscUtils.mapAndFilter.skip;

    return [workspace.anchoredLocator.locatorHash, workspace];
  }));

  const declinedWorkspaces = new Map(miscUtils.mapAndFilter([...versionFile.releases], ([workspace, decision]) => {
    if (decision !== Decision.DECLINE)
      return miscUtils.mapAndFilter.skip;

    return [workspace.anchoredLocator.locatorHash, workspace];
  }));

  // Then we check which workspaces depend on packages that will be released again but have no release strategies themselves
  for (const workspace of versionFile.project.workspaces) {
    // We allow to overrule the following check because the interactive mode wants to keep displaying the previously-undecided packages even after they have been decided
    if (!include.has(workspace)) {
      // We don't need to run the check for packages that have already been decided
      if (declinedWorkspaces.has(workspace.anchoredLocator.locatorHash))
        continue;
      if (bumpedWorkspaces.has(workspace.anchoredLocator.locatorHash)) {
        continue;
      }
    }

    // Let's assume that packages without versions don't need to see their version increased
    if (workspace.manifest.version === null)
      continue;

    for (const dependencyType of Manifest.hardDependencies) {
      for (const descriptor  of workspace.manifest.getForScope(dependencyType).values()) {
        const matchingWorkspace = versionFile.project.tryWorkspaceByDescriptor(descriptor);
        if (matchingWorkspace === null)
          continue;

        // We only care about workspaces, and we only care about workspaces that will be bumped
        if (bumpedWorkspaces.has(matchingWorkspace.anchoredLocator.locatorHash)) {
          // Quick note: we don't want to check whether the workspace pointer
          // by `resolution` is private, because while it doesn't makes sense
          // to bump a private package because its dependencies changed, the
          // opposite isn't true: a (public) package might need to be bumped
          // because one of its dev dependencies is a (private) package whose
          // behavior sensibly changed.

          undecided.push([workspace, matchingWorkspace]);
        }
      }
    }
  }

  return undecided;
}

export function suggestStrategy(from: string, to: string) {
  const cleaned = semver.clean(to);

  for (const strategy of Object.values(Decision))
    if (strategy !== Decision.UNDECIDED && strategy !== Decision.DECLINE)
      if (semver.inc(from, strategy) === cleaned)
        return strategy;

  return null;
}

export function applyStrategy(version: string | null, strategy: string) {
  if (semver.valid(strategy))
    return strategy;

  if (version === null)
    throw new UsageError(`Cannot apply the release strategy "${strategy}" unless the workspace already has a valid version`);
  if (!semver.valid(version))
    throw new UsageError(`Cannot apply the release strategy "${strategy}" on a non-semver version (${version})`);

  const nextVersion = semver.inc(version, strategy as any);
  if (nextVersion === null)
    throw new UsageError(`Cannot apply the release strategy "${strategy}" on the specified version (${version})`);

  return nextVersion;
}

export function applyReleases(project: Project, newVersions: Map<Workspace, string>, {report}: {report: Report}) {
  const allDependents: Map<Workspace, Array<[
    Workspace,
    AllDependencies,
    IdentHash,
  ]>> = new Map();

  // First we compute the reverse map to figure out which workspace is
  // depended upon by which other.
  //
  // Note that we need to do this before applying the new versions,
  // otherwise the `findWorkspacesByDescriptor` calls won't be able to
  // resolve the workspaces anymore (because the workspace versions will
  // have changed and won't match the outdated dependencies).

  for (const dependent of project.workspaces) {
    for (const set of Manifest.allDependencies) {
      for (const descriptor of dependent.manifest[set].values()) {
        const workspace = project.tryWorkspaceByDescriptor(descriptor);
        if (workspace === null)
          continue;

        // We only care about workspaces that depend on a workspace that will
        // receive a fresh update
        if (!newVersions.has(workspace))
          continue;

        const dependents = miscUtils.getArrayWithDefault(allDependents, workspace);
        dependents.push([dependent, set, descriptor.identHash]);
      }
    }
  }

  // Now that we know which workspaces depend on which others, we can
  // proceed to update everything at once using our accumulated knowledge.

  for (const [workspace, newVersion] of newVersions) {
    const oldVersion = workspace.manifest.version;
    workspace.manifest.version = newVersion;

    if (semver.prerelease(newVersion) === null)
      delete workspace.manifest.raw.stableVersion;
    else if (!workspace.manifest.raw.stableVersion)
      workspace.manifest.raw.stableVersion = oldVersion;

    const identString = workspace.manifest.name !== null
      ? structUtils.stringifyIdent(workspace.manifest.name)
      : null;

    report.reportInfo(MessageName.UNNAMED, `${structUtils.prettyLocator(project.configuration, workspace.anchoredLocator)}: Bumped to ${newVersion}`);
    report.reportJson({cwd: npath.fromPortablePath(workspace.cwd), ident: identString, oldVersion, newVersion});

    const dependents = allDependents.get(workspace);
    if (typeof dependents === `undefined`)
      continue;

    for (const [dependent, set, identHash] of dependents) {
      const descriptor = dependent.manifest[set].get(identHash);
      if (typeof descriptor === `undefined`)
        throw new Error(`Assertion failed: The dependency should have existed`);

      let range = descriptor.range;
      let useWorkspaceProtocol = false;

      if (range.startsWith(WorkspaceResolver.protocol)) {
        range = range.slice(WorkspaceResolver.protocol.length);
        useWorkspaceProtocol = true;

        // Workspaces referenced through their path never get upgraded ("workspace:packages/yarnpkg-core")
        if (range === workspace.relativeCwd) {
          continue;
        }
      }

      // We can only auto-upgrade the basic semver ranges (we can't auto-upgrade ">=1.0.0 <2.0.0", for example)
      const parsed = range.match(SUPPORTED_UPGRADE_REGEXP);
      if (!parsed) {
        report.reportWarning(MessageName.UNNAMED, `Couldn't auto-upgrade range ${range} (in ${structUtils.prettyLocator(project.configuration, dependent.anchoredLocator)})`);
        continue;
      }

      let newRange = `${parsed[1]}${newVersion}`;
      if (useWorkspaceProtocol)
        newRange = `${WorkspaceResolver.protocol}${newRange}`;

      const newDescriptor = structUtils.makeDescriptor(descriptor, newRange);
      dependent.manifest[set].set(identHash, newDescriptor);
    }
  }
}

const placeholders: Map<string, {
  extract: (parts: Array<string | number>) => [string | number, Array<string | number>] | null;
  generate: (previous?: number) => string;
}> = new Map([
  [`%n`, {
    extract: parts => {
      if (parts.length >= 1) {
        return [parts[0], parts.slice(1)];
      } else {
        return null;
      }
    },
    generate: (previous = 0) => {
      return `${previous + 1}`;
    },
  }],
]);

export function applyPrerelease(version: string, {current, prerelease}: {current: string, prerelease: string}) {
  const currentVersion = new semver.SemVer(current);

  let currentPreParts = currentVersion.prerelease.slice();
  const nextPreParts = [];

  currentVersion.prerelease = [];

  // If the version we have in mind has nothing in common with the one we want,
  // we don't want to reuse its prerelease identifiers (1.0.0-rc.5 -> 1.1.0->rc.1)
  if (currentVersion.format() !== version)
    currentPreParts.length = 0;

  let patternMatched = true;

  const patternParts = prerelease.split(/\./g);
  for (const part of patternParts) {
    const placeholder = placeholders.get(part);

    if (typeof placeholder === `undefined`) {
      nextPreParts.push(part);

      if (currentPreParts[0] === part) {
        currentPreParts.shift();
      } else {
        patternMatched = false;
      }
    } else {
      const res = patternMatched
        ? placeholder.extract(currentPreParts)
        : null;

      if (res !== null && typeof res[0] === `number`) {
        nextPreParts.push(placeholder.generate(res[0]));
        currentPreParts = res[1];
      } else {
        nextPreParts.push(placeholder.generate());
        patternMatched = false;
      }
    }
  }

  if (currentVersion.prerelease)
    currentVersion.prerelease = [];

  return `${version}-${nextPreParts.join(`.`)}`;
}
