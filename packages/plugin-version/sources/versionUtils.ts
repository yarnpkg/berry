import {AllDependencies, execUtils, miscUtils, hashUtils, Workspace, structUtils, Project, Manifest, IdentHash, Report, MessageName, WorkspaceResolver} from '@yarnpkg/core';
import {Filename, PortablePath, npath, ppath, xfs}                                                                                                      from '@yarnpkg/fslib';
import {parseSyml, stringifySyml}                                                                                                                       from '@yarnpkg/parsers';
import {UsageError}                                                                                                                                     from 'clipanion';
import semver                                                                                                                                           from 'semver';
import {version}                                                                                                                                        from 'punycode';

// Basically we only support auto-upgrading the ranges that are very simple (^x.y.z, ~x.y.z, >=x.y.z, and of course x.y.z)
const SUPPORTED_UPGRADE_REGEXP = /^(>=|[~^]|)(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-(0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(\.(0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*)?(\+[0-9a-zA-Z-]+(\.[0-9a-zA-Z-]+)*)?$/;

export enum Decision {
  UNDECIDED = 'undecided',
  DECLINE = 'decline',
  MAJOR = 'major',
  MINOR = 'minor',
  PATCH = 'patch',
  PRERELEASE = 'prerelease',
};

export type Releases =
  Map<Workspace, Exclude<Decision, Decision.UNDECIDED>>;

export async function fetchBase(root: PortablePath) {
  const candidateBases = [`master`, `origin/master`, `upstream/master`];
  const ancestorBases = [];

  for (const candidate of candidateBases) {
    const {code} = await execUtils.execvp(`git`, [`merge-base`, candidate, `HEAD`], {cwd: root});
    if (code === 0) {
      ancestorBases.push(candidate);
    }
  }

  if (ancestorBases.length === 0)
    throw new UsageError(`No ancestor could be found between any of HEAD and ${candidateBases.join(`, `)}`);

  const {stdout: mergeBaseStdout} = await execUtils.execvp(`git`, [`merge-base`, `HEAD`, ...ancestorBases], {cwd: root, strict: true});
  const hash = mergeBaseStdout.trim();

  const {stdout: showStdout} = await execUtils.execvp(`git`, [`show`, `--quiet`, `--pretty=format:%s`, hash], {cwd: root, strict: true});
  const title = showStdout.trim();

  return {hash, title};
}

export async function fetchRoot(initialCwd: PortablePath) {
  // Note: We can't just use `git rev-parse --show-toplevel`, because on Windows
  // it may return long paths even when the cwd uses short paths, and we have no
  // way to detect it from Node (not even realpath).

  let match: PortablePath | null = null;

  let cwd: PortablePath;
  let nextCwd = initialCwd;
  do {
    cwd = nextCwd;
    if (await xfs.existsPromise(ppath.join(cwd, `.git` as Filename)))
      match = cwd;
    nextCwd = ppath.dirname(cwd);
  } while (match === null && nextCwd !== cwd);

  return match;
}

export async function fetchChangedFiles(root: PortablePath, {base}: {base: string}) {
  const {stdout: localStdout} = await execUtils.execvp(`git`, [`diff`, `--name-only`, `${base}`], {cwd: root, strict: true});
  const trackedFiles = localStdout.split(/\r\n|\r|\n/).filter(file => file.length > 0).map(file => ppath.resolve(root, npath.toPortablePath(file)));

  const {stdout: untrackedStdout} = await execUtils.execvp(`git`, [`ls-files`, `--others`, `--exclude-standard`], {cwd: root, strict: true});
  const untrackedFiles = untrackedStdout.split(/\r\n|\r|\n/).filter(file => file.length > 0).map(file => ppath.resolve(root, npath.toPortablePath(file)));

  return [...new Set([...trackedFiles, ...untrackedFiles].sort())];
}

type Await<T> = T extends {
  then(onfulfilled?: (value: infer U) => unknown): unknown;
} ? U : T;

export type VersionFile = {
  project: Project,

  changedFiles: Set<PortablePath>,
  changedWorkspaces: Set<Workspace>,

  releaseRoots: Set<Workspace>,
  releases: Releases,

  saveAll: () => Promise<void>,
} & ({
  root: PortablePath,

  baseHash: string,
  baseTitle: string,
} | {
  root: null,

  baseHash: null,
  baseTitle: null,
});

export async function resolveVersionFiles(project: Project) {
  const candidateReleases = new Map<Workspace, string>();

  const deferredVersionFolder = project.configuration.get<PortablePath>(`deferredVersionFolder`);
  if (!xfs.existsSync(deferredVersionFolder))
    return new Map();

  const deferredVersionFiles = await xfs.readdirPromise(deferredVersionFolder);

  for (const entry of deferredVersionFiles) {
    if (!entry.endsWith(`.yml`))
      continue;

    const versionPath = ppath.join(deferredVersionFolder, entry);
    const versionContent = await xfs.readFilePromise(versionPath, `utf8`);
    const versionData = parseSyml(versionContent);

    for (const [locatorStr, decision] of Object.entries(versionData.releases || {})) {
      const locator = structUtils.parseLocator(locatorStr);

      const workspace = project.tryWorkspaceByLocator(locator);
      if (workspace === null)
        throw new Error(`Assertion failed: Expected a release definition file to only reference existing workspaces (${ppath.basename(versionPath)} references ${locatorStr})`);

      if (workspace.manifest.version === null)
        throw new Error(`Assertion failed: Expected the workspace to have a version (${structUtils.prettyLocator(project.configuration, workspace.anchoredLocator)})`);

      const candidateRelease = candidateReleases.get(workspace);
      const suggestedRelease = applyStrategy(workspace.manifest.version, decision as any);

      if (suggestedRelease === null)
        throw new Error(`Assertion failed: Expected ${workspace.manifest.version} to support being bumped via strategy ${decision}`);

      const bestRelease = typeof candidateRelease !== `undefined`
        ? semver.gt(suggestedRelease, candidateRelease) ? suggestedRelease : candidateRelease
        : suggestedRelease;

      candidateReleases.set(workspace, bestRelease);
    }
  }

  return candidateReleases;
}

export async function clearVersionFiles(project: Project) {
  const deferredVersionFolder = project.configuration.get<PortablePath>(`deferredVersionFolder`);
  if (!xfs.existsSync(deferredVersionFolder))
    return;

  await xfs.removePromise(deferredVersionFolder);
}

export async function updateVersionFiles(project: Project) {
  const deferredVersionFolder = project.configuration.get<PortablePath>(`deferredVersionFolder`);
  if (!xfs.existsSync(deferredVersionFolder))
    return;

  const deferredVersionFiles = await xfs.readdirPromise(deferredVersionFolder);

  for (const entry of deferredVersionFiles) {
    if (!entry.endsWith(`.yml`))
      continue;

    const versionPath = ppath.join(deferredVersionFolder, entry);
    const versionContent = await xfs.readFilePromise(versionPath, `utf8`);
    const versionData = parseSyml(versionContent);

    if (typeof versionData.releases === `undefined`)
      continue;

    for (const locatorStr of Object.keys(versionData.releases || {})) {
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

  const root = await fetchRoot(configuration.projectCwd);

  const base = root !== null
    ? await fetchBase(root)
    : null;

  const changedFiles = root !== null
    ? await fetchChangedFiles(root, {base: base!.hash})
    : [];

  const deferredVersionFolder = configuration.get<PortablePath>(`deferredVersionFolder`);
  const versionFiles = changedFiles.filter(p => ppath.contains(deferredVersionFolder, p) !== null);

  if (versionFiles.length > 1)
    throw new UsageError(`Your current branch contains multiple versioning files; this isn't supported:\n- ${versionFiles.join(`\n- `)}`);

  const changedWorkspaces = new Set(changedFiles.map(file => project.getWorkspaceByFilePath(file)));
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

  for (const locatorStr of versionData.declined || []) {
    const locator = structUtils.parseLocator(locatorStr);
    const workspace = project.getWorkspaceByLocator(locator);

    releaseStore.set(workspace, Decision.DECLINE);
  }

  for (const [locatorStr, decision] of Object.entries(versionData.releases || {})) {
    const locator = structUtils.parseLocator(locatorStr);
    const workspace = project.getWorkspaceByLocator(locator);

    releaseStore.set(workspace, decision as any);
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
      const releases: {[key: string]: Exclude<Decision, Decision.UNDECIDED | Decision.DECLINE>} = {};
      const declined: Array<string> = [];
      const undecided: Array<string> = [];

      for (const workspace of project.workspaces) {
        // Let's assume that packages without versions don't need to see their version increased
        if (workspace.manifest.version === null)
          continue;

        const locatorStr = structUtils.stringifyLocator(workspace.locator);

        const decision = releaseStore.get(workspace);
        if (decision === Decision.DECLINE) {
          declined.push(locatorStr);
        } else if (typeof decision !== `undefined`) {
          releases[locatorStr] = decision;
        } else if (changedWorkspaces.has(workspace)) {
          undecided.push(locatorStr);
        }
      }

      await xfs.mkdirpPromise(ppath.dirname(versionPath));

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
        const matchingWorkspaces = versionFile.project.findWorkspacesByDescriptor(descriptor);

        for (const workspaceDependency of matchingWorkspaces) {
          // We only care about workspaces, and we only care about workspaces that will be bumped
          if (bumpedWorkspaces.has(workspaceDependency.anchoredLocator.locatorHash)) {
            // Quick note: we don't want to check whether the workspace pointer
            // by `resolution` is private, because while it doesn't makes sense
            // to bump a private package because its dependencies changed, the
            // opposite isn't true: a (public) package might need to be bumped
            // because one of its dev dependencies is a (private) package whose
            // behavior sensibly changed.

            undecided.push([workspace, workspaceDependency]);
          }
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
        const workspaces = project.findWorkspacesByDescriptor(descriptor);
        if (workspaces.length !== 1)
          continue;

        // We only care about workspaces that depend on a workspace that will
        // receive a fresh update
        const dependency = workspaces[0];
        if (!newVersions.has(dependency))
          continue;

        const dependents = miscUtils.getArrayWithDefault(allDependents, dependency);
        dependents.push([dependent, set, descriptor.identHash]);
      }
    }
  }

  // Now that we know which workspaces depend on which others, we can
  // proceed to update everything at once using our accumulated knowledge.

  for (const [workspace, newVersion] of newVersions) {
    const oldVersion = workspace.manifest.version;
    workspace.manifest.version = newVersion;

    const identString = workspace.manifest.name !== null
      ? structUtils.stringifyIdent(workspace.manifest.name)
      : null;

    report.reportInfo(MessageName.UNNAMED, `${structUtils.prettyLocator(project.configuration, workspace.anchoredLocator)}: Bumped to ${newVersion}`);
    report.reportJson({cwd: workspace.cwd, ident: identString, oldVersion, newVersion});

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
        report.reportWarning(MessageName.UNNAMED, `Couldn't auto-upgrade range ${range} (in ${structUtils.prettyLocator(project.configuration, workspace.anchoredLocator)})`);
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
