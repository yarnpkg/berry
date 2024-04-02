import {npath}                                                          from '@yarnpkg/fslib';
import {PortablePath, ppath, xfs, normalizeLineEndings, Filename}       from '@yarnpkg/fslib';
import {parseSyml, stringifySyml}                                       from '@yarnpkg/parsers';
import {UsageError}                                                     from 'clipanion';
import {createHash}                                                     from 'crypto';
import {structuredPatch}                                                from 'diff';
import pick                                                             from 'lodash/pick';
import pLimit                                                           from 'p-limit';
import semver                                                           from 'semver';
import internal                                                         from 'stream';
import {promisify}                                                      from 'util';
import v8                                                               from 'v8';
import zlib                                                             from 'zlib';

import {Cache, CacheOptions}                                            from './Cache';
import {Configuration}                                                  from './Configuration';
import {Fetcher, FetchOptions}                                          from './Fetcher';
import {Installer, BuildDirective, BuildDirectiveType, InstallStatus}   from './Installer';
import {LegacyMigrationResolver}                                        from './LegacyMigrationResolver';
import {Linker, LinkOptions}                                            from './Linker';
import {LockfileResolver}                                               from './LockfileResolver';
import {DependencyMeta, Manifest, type PeerDependencyMeta}              from './Manifest';
import {MessageName}                                                    from './MessageName';
import {MultiResolver}                                                  from './MultiResolver';
import {Report, ReportError}                                            from './Report';
import {ResolveOptions, Resolver}                                       from './Resolver';
import {RunInstallPleaseResolver}                                       from './RunInstallPleaseResolver';
import {SUPPORTS_GROUPS, StreamReport}                                  from './StreamReport';
import {ThrowReport}                                                    from './ThrowReport';
import {WorkspaceResolver}                                              from './WorkspaceResolver';
import {Workspace}                                                      from './Workspace';
import {isFolderInside}                                                 from './folderUtils';
import * as formatUtils                                                 from './formatUtils';
import * as hashUtils                                                   from './hashUtils';
import * as miscUtils                                                   from './miscUtils';
import * as nodeUtils                                                   from './nodeUtils';
import * as scriptUtils                                                 from './scriptUtils';
import * as semverUtils                                                 from './semverUtils';
import * as structUtils                                                 from './structUtils';
import {LinkType}                                                       from './types';
import {Descriptor, Ident, Locator, Package}                            from './types';
import {IdentHash, DescriptorHash, LocatorHash, PackageExtensionStatus} from './types';

// When upgraded, the lockfile entries have to be resolved again (but the specific
// versions are still pinned, no worry). Bump it when you change the fields within
// the Package type; no more no less.
export const LOCKFILE_VERSION = miscUtils.parseInt(
  process.env.YARN_LOCKFILE_VERSION_OVERRIDE ??
  8,
);

// Same thing but must be bumped when the members of the Project class changes (we
// don't recommend our users to check-in this file, so it's fine to bump it even
// between patch or minor releases).
const INSTALL_STATE_VERSION = 3;

const MULTIPLE_KEYS_REGEXP = / *, */g;
const TRAILING_SLASH_REGEXP = /\/$/;

const FETCHER_CONCURRENCY = 32;

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export enum InstallMode {
  /**
   * Doesn't run the link step, and only fetches what's necessary to compute
   * an updated lockfile.
   */
  UpdateLockfile = `update-lockfile`,

  /**
   * Don't run the build scripts.
   */
  SkipBuild = `skip-build`,
}

export type InstallOptions = {
  /**
   * Instance of the cache that the project will use when packages have to be
   * fetched. Some fetches may occur even during the resolution, for example
   * when resolving git packages.
   */
  cache: Cache;

  /**
   * An optional override for the default fetching pipeline. This is for
   * overrides only - if you need to _add_ resolvers, prefer adding them
   * through regular plugins instead.
   */
  fetcher?: Fetcher;

  /**
   * An optional override for the default resolution pipeline. This is for
   * overrides only - if you need to _add_ resolvers, prefer adding them
   * through regular plugins instead.
   */
  resolver?: Resolver;

  /**
   * Provide a report instance that'll be use to store the information emitted
   * during the install process.
   */
  report: Report;

  /**
   * If true, Yarn will check that the lockfile won't change after the
   * resolution step. Additionally, after the link step, Yarn will retrieve
   * the list of files in `immutablePatterns` and check that they didn't get
   * modified either.
   */
  immutable?: boolean;

  /**
   * If true, Yarn will exclusively use the lockfile metadata. Setting this
   * flag will cause it to ignore any change in the manifests, and to abort
   * if any dependency isn't present in the lockfile.
   */
  lockfileOnly?: boolean;

  /**
   * If true, Yarn will check that the pre-existing resolutions found in the
   * lockfile are coherent with the ranges that depend on them.
   */
  checkResolutions?: boolean;

  /**
   * Changes which artifacts are generated during the install. Check the
   * enumeration documentation for details.
   */
  mode?: InstallMode;

  /**
   * If true (the default), Yarn will update the workspace manifests once the
   * install has completed.
   */
  persistProject?: boolean;
};

const INSTALL_STATE_FIELDS = {
  restoreLinkersCustomData: [
    `linkersCustomData`,
  ] as const,

  restoreResolutions: [
    `accessibleLocators`,
    `conditionalLocators`,
    `disabledLocators`,
    `optionalBuilds`,
    `storedDescriptors`,
    `storedResolutions`,
    `storedPackages`,
    `lockFileChecksum`,
  ] as const,

  restoreBuildState: [
    `skippedBuilds`,
    `storedBuildState`,
  ] as const,
};

type RestoreInstallStateOpts = {
  [key in keyof typeof INSTALL_STATE_FIELDS]?: boolean;
};

// Just a type that's the union of all the fields declared in `INSTALL_STATE_FIELDS`
type InstallState = Pick<Project, typeof INSTALL_STATE_FIELDS[keyof typeof INSTALL_STATE_FIELDS][number]>;

export type PeerRequestNode = {
  requester: Locator;
  descriptor: Descriptor;
  meta: PeerDependencyMeta | undefined;

  children: Map<DescriptorHash, PeerRequestNode>;
};

export type PeerRequirementNode = {
  subject: Locator;
  ident: Ident;
  provided: Descriptor;
  root: boolean;

  requests: Map<DescriptorHash, PeerRequestNode>;

  hash: string;
};

export type PeerRequirement = {
  subject: LocatorHash;
  requested: Ident;
  rootRequester: LocatorHash;
  allRequesters: Array<LocatorHash>;
};

export enum PeerWarningType {
  NotProvided,
  NotCompatible,
  NodeNotProvided,
  NodeNotCompatible,
}

export type PeerWarning = {
  type: PeerWarningType.NotProvided;
  subject: Locator;
  requested: Ident;
  requester: Ident;
  hash: string;
} | {
  type: PeerWarningType.NotCompatible;
  subject: Locator;
  requested: Ident;
  requester: Ident;
  version: string;
  hash: string;
  requirementCount: number;
} | {
  type: PeerWarningType.NodeNotProvided;
  node: PeerRequirementNode;
  hash: string;
} | {
  type: PeerWarningType.NodeNotCompatible;
  node: PeerRequirementNode;
  range: string | null;
  hash: string;
};

const makeLockfileChecksum = (normalizedContent: string) =>
  hashUtils.makeHash(`${INSTALL_STATE_VERSION}`, normalizedContent);

export class Project {
  public readonly configuration: Configuration;
  public readonly cwd: PortablePath;

  /**
   * Is meant to be populated by the consumer. Should the descriptor referenced
   * by the key be requested, the descriptor referenced in the value will be
   * resolved instead. The resolved data will then be used as final resolution
   * for the initial descriptor.
   *
   * Note that the lockfile will contain the second descriptor but not the
   * first one (meaning that if you remove the alias during a subsequent
   * install, it'll be lost and the real package will be resolved / installed).
   */
  public resolutionAliases: Map<DescriptorHash, DescriptorHash> = new Map();

  public workspaces: Array<Workspace> = [];

  public workspacesByCwd: Map<PortablePath, Workspace> = new Map();
  public workspacesByIdent: Map<IdentHash, Workspace> = new Map();

  public storedResolutions: Map<DescriptorHash, LocatorHash> = new Map();
  public storedDescriptors: Map<DescriptorHash, Descriptor> = new Map();
  public storedPackages: Map<LocatorHash, Package> = new Map();
  public storedChecksums: Map<LocatorHash, string> = new Map();
  public storedBuildState: Map<LocatorHash, string> = new Map();

  public accessibleLocators: Set<LocatorHash> = new Set();
  public conditionalLocators: Set<LocatorHash> = new Set();
  public disabledLocators: Set<LocatorHash> = new Set();
  public originalPackages: Map<LocatorHash, Package> = new Map();
  public optionalBuilds: Set<LocatorHash> = new Set();
  public skippedBuilds: Set<LocatorHash> = new Set();

  /**
   * If true, the data contained within `originalPackages` are from a different
   * lockfile version and need to be refreshed.
   */
  public lockfileLastVersion: number | null = null;
  public lockfileNeedsRefresh: boolean = false;

  /**
   * Populated by the `resolveEverything` method.
   * *Not* stored inside the install state.
   *
   * The map keys are 6 hexadecimal characters except the first one, always `p`.
   */
  public peerRequirements: Map<string, PeerRequirement> = new Map();
  public peerWarnings: Array<PeerWarning> = [];
  public peerRequirementNodes: Map<string, PeerRequirementNode> = new Map();

  /**
   * Contains whatever data the linkers (cf `Linker.ts`) want to persist
   * from an install to another.
   */
  public linkersCustomData: Map<string, unknown> = new Map();

  /**
   * Those checksums are used to detect whether the relevant files actually
   * changed since we last read them (to skip part of their generation).
   */
  public lockFileChecksum: string | null = null;
  public installStateChecksum: string | null = null;

  static async find(configuration: Configuration, startingCwd: PortablePath): Promise<{project: Project, workspace: Workspace | null, locator: Locator}> {
    if (!configuration.projectCwd)
      throw new UsageError(`No project found in ${startingCwd}`);

    let packageCwd = configuration.projectCwd;

    let nextCwd = startingCwd;
    let currentCwd = null;

    while (currentCwd !== configuration.projectCwd) {
      currentCwd = nextCwd;

      if (xfs.existsSync(ppath.join(currentCwd, Filename.manifest))) {
        packageCwd = currentCwd;
        break;
      }

      nextCwd = ppath.dirname(currentCwd);
    }

    const project = new Project(configuration.projectCwd, {configuration});

    Configuration.telemetry?.reportProject(project.cwd);

    await project.setupResolutions();
    await project.setupWorkspaces();

    Configuration.telemetry?.reportWorkspaceCount(project.workspaces.length);
    Configuration.telemetry?.reportDependencyCount(project.workspaces.reduce((sum, workspace) => sum + workspace.manifest.dependencies.size + workspace.manifest.devDependencies.size, 0));

    // If we're in a workspace, no need to go any further to find which package we're in
    const workspace = project.tryWorkspaceByCwd(packageCwd);
    if (workspace)
      return {project, workspace, locator: workspace.anchoredLocator};

    // Otherwise, we need to ask the project (which will in turn ask the linkers for help)
    // Note: the trailing slash is caused by a quirk in the PnP implementation that requires folders to end with a trailing slash to disambiguate them from regular files
    const locator = await project.findLocatorForLocation(`${packageCwd}/` as PortablePath, {strict: true});
    if (locator)
      return {project, locator, workspace: null};

    const projectCwdLog = formatUtils.pretty(configuration, project.cwd, formatUtils.Type.PATH);
    const packageCwdLog = formatUtils.pretty(configuration, ppath.relative(project.cwd, packageCwd), formatUtils.Type.PATH);

    const unintendedProjectLog = `- If ${projectCwdLog} isn't intended to be a project, remove any yarn.lock and/or package.json file there.`;
    const missingWorkspaceLog = `- If ${projectCwdLog} is intended to be a project, it might be that you forgot to list ${packageCwdLog} in its workspace configuration.`;
    const decorrelatedProjectLog = `- Finally, if ${projectCwdLog} is fine and you intend ${packageCwdLog} to be treated as a completely separate project (not even a workspace), create an empty yarn.lock file in it.`;

    throw new UsageError(`The nearest package directory (${formatUtils.pretty(configuration, packageCwd, formatUtils.Type.PATH)}) doesn't seem to be part of the project declared in ${formatUtils.pretty(configuration, project.cwd, formatUtils.Type.PATH)}.\n\n${[
      unintendedProjectLog,
      missingWorkspaceLog,
      decorrelatedProjectLog,
    ].join(`\n`)}`);
  }

  constructor(projectCwd: PortablePath, {configuration}: {configuration: Configuration}) {
    this.configuration = configuration;
    this.cwd = projectCwd;
  }

  private async setupResolutions() {
    this.storedResolutions = new Map();

    this.storedDescriptors = new Map();
    this.storedPackages = new Map();

    this.lockFileChecksum = null;

    const lockfilePath = ppath.join(this.cwd, Filename.lockfile);
    const defaultLanguageName = this.configuration.get(`defaultLanguageName`);

    if (xfs.existsSync(lockfilePath)) {
      const content = await xfs.readFilePromise(lockfilePath, `utf8`);

      // We store the salted checksum of the lockfile in order to invalidate the install state when needed
      this.lockFileChecksum = makeLockfileChecksum(content);

      const parsed: any = parseSyml(content);

      // Protects against v1 lockfiles
      if (parsed.__metadata) {
        const lockfileVersion = parsed.__metadata.version;
        const cacheKey = parsed.__metadata.cacheKey;

        this.lockfileLastVersion = lockfileVersion;
        this.lockfileNeedsRefresh = lockfileVersion < LOCKFILE_VERSION;

        for (const key of Object.keys(parsed)) {
          if (key === `__metadata`)
            continue;

          const data = parsed[key];
          if (typeof data.resolution === `undefined`)
            throw new Error(`Assertion failed: Expected the lockfile entry to have a resolution field (${key})`);

          const locator = structUtils.parseLocator(data.resolution, true);

          const manifest = new Manifest();
          manifest.load(data, {yamlCompatibilityMode: true});

          const version = manifest.version;

          const languageName = manifest.languageName || defaultLanguageName;
          const linkType = data.linkType.toUpperCase() as LinkType;

          const conditions = data.conditions ?? null;

          const dependencies = manifest.dependencies;
          const peerDependencies = manifest.peerDependencies;

          const dependenciesMeta = manifest.dependenciesMeta;
          const peerDependenciesMeta = manifest.peerDependenciesMeta;

          const bin = manifest.bin;

          if (data.checksum != null) {
            const checksum = typeof cacheKey !== `undefined` && !data.checksum.includes(`/`)
              ? `${cacheKey}/${data.checksum}`
              : data.checksum;

            this.storedChecksums.set(locator.locatorHash, checksum);
          }

          const pkg: Package = {...locator, version, languageName, linkType, conditions, dependencies, peerDependencies, dependenciesMeta, peerDependenciesMeta, bin};
          this.originalPackages.set(pkg.locatorHash, pkg);

          for (const entry of key.split(MULTIPLE_KEYS_REGEXP)) {
            let descriptor = structUtils.parseDescriptor(entry);

            // Yarn pre-v4 used to generate descriptors that were sometimes
            // missing the `npm:` protocol
            if (lockfileVersion <= 6) {
              descriptor = this.configuration.normalizeDependency(descriptor);
              descriptor = structUtils.makeDescriptor(descriptor, descriptor.range.replace(/^patch:[^@]+@(?!npm(:|%3A))/, `$1npm%3A`));
            }

            this.storedDescriptors.set(descriptor.descriptorHash, descriptor);
            this.storedResolutions.set(descriptor.descriptorHash, locator.locatorHash);
          }
        }
      } else if (content.includes(`yarn lockfile v1`)) {
        this.lockfileLastVersion = -1;
      }
    }
  }

  private async setupWorkspaces() {
    this.workspaces = [];

    this.workspacesByCwd = new Map();
    this.workspacesByIdent = new Map();

    const pathsChecked = new Set<PortablePath>();
    const limitSetup = pLimit(4);

    const loadWorkspaceReducer = async (previousTask: Promise<void>, workspaceCwd: PortablePath): Promise<void> => {
      if (pathsChecked.has(workspaceCwd))
        return previousTask;

      pathsChecked.add(workspaceCwd);

      const workspace = new Workspace(workspaceCwd, {project: this});
      await limitSetup(() => workspace.setup());

      const nextTask = previousTask.then(() => {
        this.addWorkspace(workspace);
      });

      return Array.from(workspace.workspacesCwds).reduce(loadWorkspaceReducer, nextTask);
    };

    await loadWorkspaceReducer(Promise.resolve(), this.cwd);
  }

  private addWorkspace(workspace: Workspace) {
    const dup = this.workspacesByIdent.get(workspace.anchoredLocator.identHash);
    if (typeof dup !== `undefined`)
      throw new Error(`Duplicate workspace name ${structUtils.prettyIdent(this.configuration, workspace.anchoredLocator)}: ${npath.fromPortablePath(workspace.cwd)} conflicts with ${npath.fromPortablePath(dup.cwd)}`);

    this.workspaces.push(workspace);

    this.workspacesByCwd.set(workspace.cwd, workspace);
    this.workspacesByIdent.set(workspace.anchoredLocator.identHash, workspace);
  }

  get topLevelWorkspace() {
    return this.getWorkspaceByCwd(this.cwd);
  }

  tryWorkspaceByCwd(workspaceCwd: PortablePath) {
    if (!ppath.isAbsolute(workspaceCwd))
      workspaceCwd = ppath.resolve(this.cwd, workspaceCwd);

    workspaceCwd = ppath.normalize(workspaceCwd)
      .replace(/\/+$/, ``) as PortablePath;

    const workspace = this.workspacesByCwd.get(workspaceCwd);
    if (!workspace)
      return null;

    return workspace;
  }

  getWorkspaceByCwd(workspaceCwd: PortablePath) {
    const workspace = this.tryWorkspaceByCwd(workspaceCwd);
    if (!workspace)
      throw new Error(`Workspace not found (${workspaceCwd})`);

    return workspace;
  }

  tryWorkspaceByFilePath(filePath: PortablePath) {
    let bestWorkspace = null;

    for (const workspace of this.workspaces) {
      const rel = ppath.relative(workspace.cwd, filePath);
      if (rel.startsWith(`../`))
        continue;

      if (bestWorkspace && bestWorkspace.cwd.length >= workspace.cwd.length)
        continue;

      bestWorkspace = workspace;
    }

    if (!bestWorkspace)
      return null;

    return bestWorkspace;
  }

  getWorkspaceByFilePath(filePath: PortablePath) {
    const workspace = this.tryWorkspaceByFilePath(filePath);
    if (!workspace)
      throw new Error(`Workspace not found (${filePath})`);

    return workspace;
  }

  tryWorkspaceByIdent(ident: Ident) {
    const workspace = this.workspacesByIdent.get(ident.identHash);

    if (typeof workspace === `undefined`)
      return null;

    return workspace;
  }

  getWorkspaceByIdent(ident: Ident) {
    const workspace = this.tryWorkspaceByIdent(ident);

    if (!workspace)
      throw new Error(`Workspace not found (${structUtils.prettyIdent(this.configuration, ident)})`);

    return workspace;
  }

  tryWorkspaceByDescriptor(descriptor: Descriptor) {
    if (descriptor.range.startsWith(WorkspaceResolver.protocol)) {
      const specifier = descriptor.range.slice(WorkspaceResolver.protocol.length) as PortablePath;
      if (specifier !== `^` && specifier !== `~` && specifier !== `*` && !semverUtils.validRange(specifier)) {
        return this.tryWorkspaceByCwd(specifier);
      }
    }

    const workspace = this.tryWorkspaceByIdent(descriptor);
    if (workspace === null)
      return null;

    if (structUtils.isVirtualDescriptor(descriptor))
      descriptor = structUtils.devirtualizeDescriptor(descriptor);

    if (!workspace.accepts(descriptor.range))
      return null;

    return workspace;
  }

  getWorkspaceByDescriptor(descriptor: Descriptor) {
    const workspace = this.tryWorkspaceByDescriptor(descriptor);

    if (workspace === null)
      throw new Error(`Workspace not found (${structUtils.prettyDescriptor(this.configuration, descriptor)})`);

    return workspace;
  }

  tryWorkspaceByLocator(locator: Locator) {
    const workspace = this.tryWorkspaceByIdent(locator);
    if (workspace === null)
      return null;

    if (structUtils.isVirtualLocator(locator))
      locator = structUtils.devirtualizeLocator(locator);

    if (workspace.anchoredLocator.locatorHash !== locator.locatorHash)
      return null;

    return workspace;
  }

  getWorkspaceByLocator(locator: Locator) {
    const workspace = this.tryWorkspaceByLocator(locator);

    if (!workspace)
      throw new Error(`Workspace not found (${structUtils.prettyLocator(this.configuration, locator)})`);

    return workspace;
  }

  private deleteDescriptor(descriptorHash: DescriptorHash) {
    this.storedResolutions.delete(descriptorHash);
    this.storedDescriptors.delete(descriptorHash);
  }

  private deleteLocator(locatorHash: LocatorHash) {
    this.originalPackages.delete(locatorHash);
    this.storedPackages.delete(locatorHash);
    this.accessibleLocators.delete(locatorHash);
  }

  forgetResolution(descriptor: Descriptor): void;
  forgetResolution(locator: Locator): void;
  forgetResolution(dataStructure: Descriptor | Locator): void {
    if (`descriptorHash` in dataStructure) {
      const locatorHash = this.storedResolutions.get(dataStructure.descriptorHash);

      this.deleteDescriptor(dataStructure.descriptorHash);

      // We delete unused locators
      const remainingResolutions = new Set(this.storedResolutions.values());
      if (typeof locatorHash !== `undefined` && !remainingResolutions.has(locatorHash)) {
        this.deleteLocator(locatorHash);
      }
    }

    if (`locatorHash` in dataStructure) {
      this.deleteLocator(dataStructure.locatorHash);

      // We delete all of the descriptors that have been resolved to the locator
      for (const [descriptorHash, locatorHash] of this.storedResolutions) {
        if (locatorHash === dataStructure.locatorHash) {
          this.deleteDescriptor(descriptorHash);
        }
      }
    }
  }

  forgetTransientResolutions() {
    const resolver = this.configuration.makeResolver();

    const reverseLookup = new Map<LocatorHash, Set<DescriptorHash>>();

    for (const [descriptorHash, locatorHash] of this.storedResolutions.entries()) {
      let descriptorHashes = reverseLookup.get(locatorHash);
      if (!descriptorHashes)
        reverseLookup.set(locatorHash, descriptorHashes = new Set());

      descriptorHashes.add(descriptorHash);
    }

    for (const pkg of this.originalPackages.values()) {
      let shouldPersistResolution: boolean;
      try {
        shouldPersistResolution = resolver.shouldPersistResolution(pkg, {project: this, resolver});
      } catch {
        shouldPersistResolution = false;
      }

      if (!shouldPersistResolution) {
        this.deleteLocator(pkg.locatorHash);

        const descriptors = reverseLookup.get(pkg.locatorHash);
        if (descriptors) {
          reverseLookup.delete(pkg.locatorHash);
          for (const descriptorHash of descriptors) {
            this.deleteDescriptor(descriptorHash);
          }
        }
      }
    }
  }

  forgetVirtualResolutions() {
    for (const pkg of this.storedPackages.values()) {
      for (const [dependencyHash, dependency] of pkg.dependencies) {
        if (structUtils.isVirtualDescriptor(dependency)) {
          pkg.dependencies.set(dependencyHash, structUtils.devirtualizeDescriptor(dependency));
        }
      }
    }
  }

  getDependencyMeta(ident: Ident, version: string | null): DependencyMeta {
    const dependencyMeta = {};

    const dependenciesMeta = this.topLevelWorkspace.manifest.dependenciesMeta;
    const dependencyMetaSet = dependenciesMeta.get(structUtils.stringifyIdent(ident));

    if (!dependencyMetaSet)
      return dependencyMeta;

    const defaultMeta = dependencyMetaSet.get(null);
    if (defaultMeta)
      Object.assign(dependencyMeta, defaultMeta);

    if (version === null || !semver.valid(version))
      return dependencyMeta;

    for (const [range, meta] of dependencyMetaSet)
      if (range !== null && range === version)
        Object.assign(dependencyMeta, meta);

    return dependencyMeta;
  }

  async findLocatorForLocation(cwd: PortablePath, {strict = false}: {strict?: boolean} = {}) {
    const report = new ThrowReport();

    const linkers = this.configuration.getLinkers();
    const linkerOptions = {project: this, report};

    for (const linker of linkers) {
      const locator = await linker.findPackageLocator(cwd, linkerOptions);
      if (locator) {
        // If strict mode, the specified cwd must be a package,
        // not merely contained in a package.
        if (strict) {
          const location = await linker.findPackageLocation(locator, linkerOptions);
          if (location.replace(TRAILING_SLASH_REGEXP, ``) !== cwd.replace(TRAILING_SLASH_REGEXP, ``)) {
            continue;
          }
        }
        return locator;
      }
    }

    return null;
  }

  async loadUserConfig() {
    // TODO: We're injecting the .pnp.cjs in the environment, so that it's
    // able to required the project dependencies. It's not ideal to hardcode
    // this logic here, but I'm not quite sure yet what would be a better place.
    //
    const pnpPath = ppath.join(this.cwd, `.pnp.cjs`);
    if (await xfs.existsPromise(pnpPath))
      miscUtils.dynamicRequire(pnpPath).setup();

    const configPath = ppath.join(this.cwd, `yarn.config.cjs`);
    if (!await xfs.existsPromise(configPath))
      return null;

    return miscUtils.dynamicRequire(configPath);
  }

  async preparePackage(originalPkg: Package, {resolver, resolveOptions}: {resolver: Resolver, resolveOptions: ResolveOptions}) {
    const packageExtensions = await this.configuration.getPackageExtensions();

    const pkg = this.configuration.normalizePackage(originalPkg, {packageExtensions});

    for (const [identHash, descriptor] of pkg.dependencies) {
      const dependency = await this.configuration.reduceHook(hooks => {
        return hooks.reduceDependency;
      }, descriptor, this, pkg, descriptor, {
        resolver,
        resolveOptions,
      });

      if (!structUtils.areIdentsEqual(descriptor, dependency))
        throw new Error(`Assertion failed: The descriptor ident cannot be changed through aliases`);

      const bound = resolver.bindDescriptor(dependency, pkg, resolveOptions);
      pkg.dependencies.set(identHash, bound);
    }

    return pkg;
  }

  async resolveEverything(opts: Pick<InstallOptions, `report` | `resolver` | `checkResolutions` | `mode`> & ({report: Report, lockfileOnly: true} | {lockfileOnly?: boolean, cache: Cache})) {
    if (!this.workspacesByCwd || !this.workspacesByIdent)
      throw new Error(`Workspaces must have been setup before calling this function`);

    // Reverts the changes that have been applied to the tree because of any previous virtual resolution pass
    this.forgetVirtualResolutions();

    // Keep a copy of the original packages so that we can figure out what was added / removed later
    const initialPackages = new Map(this.originalPackages);

    const addedPackages: Array<Locator> = [];

    // Ensures that we notice it when dependencies are added / removed from all sources coming from the filesystem
    if (!opts.lockfileOnly)
      this.forgetTransientResolutions();

    // Note that the resolution process is "offline" until everything has been
    // successfully resolved; all the processing is expected to have zero side
    // effects until we're ready to set all the variables at once (the one
    // exception being when a resolver needs to fetch a package, in which case
    // we might need to populate the cache).
    //
    // This makes it possible to use the same Project instance for multiple
    // purposes at the same time (since `resolveEverything` is async, it might
    // happen that we want to do something while waiting for it to end; if we
    // were to mutate the project then it would end up in a partial state that
    // could lead to hard-to-debug issues).

    const realResolver = opts.resolver || this.configuration.makeResolver();

    const legacyMigrationResolver = new LegacyMigrationResolver(realResolver);
    await legacyMigrationResolver.setup(this, {report: opts.report});

    const resolverChain = opts.lockfileOnly
      ? [new RunInstallPleaseResolver(realResolver)]
      : [legacyMigrationResolver, realResolver];

    const resolver: Resolver = new MultiResolver([
      new LockfileResolver(realResolver),
      ...resolverChain,
    ]);

    const noLockfileResolver: Resolver = new MultiResolver([
      ...resolverChain,
    ]);

    const fetcher = this.configuration.makeFetcher();

    const resolveOptions: ResolveOptions = opts.lockfileOnly
      ? {project: this, report: opts.report, resolver}
      : {project: this, report: opts.report, resolver, fetchOptions: {project: this, cache: opts.cache, checksums: this.storedChecksums, report: opts.report, fetcher, cacheOptions: {mirrorWriteOnly: true}}};

    const allDescriptors = new Map<DescriptorHash, Descriptor>();
    const allPackages = new Map<LocatorHash, Package>();
    const allResolutions = new Map<DescriptorHash, LocatorHash>();

    const originalPackages = new Map<LocatorHash, Package>();

    const packageResolutionPromises = new Map<LocatorHash, Promise<Package>>();
    const descriptorResolutionPromises = new Map<DescriptorHash, Promise<Package>>();

    const dependencyResolutionLocator = this.topLevelWorkspace.anchoredLocator;
    const resolutionDependencies = new Set<LocatorHash>();

    const resolutionQueue: Array<Promise<unknown>> = [];

    // Doing these calls early is important: it seems calling it after we've started the resolution incurs very high
    // performance penalty on WSL, with the Gatsby benchmark jumping from ~28s to ~130s. It's possible this is due to
    // the number of async tasks being listed in the report, although it's strange this doesn't occur on other systems.
    const currentArchitecture = nodeUtils.getArchitectureSet();
    const supportedArchitectures = this.configuration.getSupportedArchitectures();

    await opts.report.startProgressPromise(Report.progressViaTitle(), async progress => {
      const startPackageResolution = async (locator: Locator) => {
        const originalPkg = await miscUtils.prettifyAsyncErrors(async () => {
          return await resolver.resolve(locator, resolveOptions);
        }, message => {
          return `${structUtils.prettyLocator(this.configuration, locator)}: ${message}`;
        });

        if (!structUtils.areLocatorsEqual(locator, originalPkg))
          throw new Error(`Assertion failed: The locator cannot be changed by the resolver (went from ${structUtils.prettyLocator(this.configuration, locator)} to ${structUtils.prettyLocator(this.configuration, originalPkg)})`);

        originalPackages.set(originalPkg.locatorHash, originalPkg);

        // What didn't exist before is an added package
        const existedBefore = initialPackages.delete(originalPkg.locatorHash);
        if (!existedBefore && !this.tryWorkspaceByLocator(originalPkg))
          addedPackages.push(originalPkg);

        const pkg = await this.preparePackage(originalPkg, {resolver, resolveOptions});

        const dependencyResolutions = miscUtils.allSettledSafe([...pkg.dependencies.values()].map(descriptor => {
          return scheduleDescriptorResolution(descriptor);
        }));

        resolutionQueue.push(dependencyResolutions);

        // While the promise is now part of `resolutionQueue`, nothing is
        // technically `awaiting` it just yet (and nothing will until the
        // current resolution pass fully ends, and the next one starts).
        //
        // To avoid V8 printing an UnhandledPromiseRejectionWarning, we
        // bind a empty `catch`.
        //
        dependencyResolutions.catch(() => {});

        allPackages.set(pkg.locatorHash, pkg);

        return pkg;
      };

      const schedulePackageResolution = async (locator: Locator) => {
        const promise = packageResolutionPromises.get(locator.locatorHash);
        if (typeof promise !== `undefined`)
          return promise;

        const newPromise = Promise.resolve().then(() => startPackageResolution(locator));
        packageResolutionPromises.set(locator.locatorHash, newPromise);
        return newPromise;
      };

      const startDescriptorAliasing = async (descriptor: Descriptor, alias: Descriptor): Promise<Package> => {
        const resolution = await scheduleDescriptorResolution(alias);

        allDescriptors.set(descriptor.descriptorHash, descriptor);
        allResolutions.set(descriptor.descriptorHash, resolution.locatorHash);

        return resolution;
      };

      const startDescriptorResolution = async (descriptor: Descriptor): Promise<Package> => {
        progress.setTitle(structUtils.prettyDescriptor(this.configuration, descriptor));

        const alias = this.resolutionAliases.get(descriptor.descriptorHash);
        if (typeof alias !== `undefined`)
          return startDescriptorAliasing(descriptor, this.storedDescriptors.get(alias)!);

        const resolutionDependenciesList = resolver.getResolutionDependencies(descriptor, resolveOptions);
        const resolvedDependencies = Object.fromEntries(
          await miscUtils.allSettledSafe(
            Object.entries(resolutionDependenciesList).map(async ([dependencyName, dependency]) => {
              const bound = resolver.bindDescriptor(dependency, dependencyResolutionLocator, resolveOptions);

              const resolvedPackage = await scheduleDescriptorResolution(bound);
              resolutionDependencies.add(resolvedPackage.locatorHash);

              return [dependencyName, resolvedPackage] as const;
            }),
          ),
        );

        const candidateResolutions = await miscUtils.prettifyAsyncErrors(async () => {
          return await resolver.getCandidates(descriptor, resolvedDependencies, resolveOptions);
        }, message => {
          return `${structUtils.prettyDescriptor(this.configuration, descriptor)}: ${message}`;
        });

        const finalResolution = candidateResolutions[0];
        if (typeof finalResolution === `undefined`)
          throw new ReportError(MessageName.RESOLUTION_FAILED, `${structUtils.prettyDescriptor(this.configuration, descriptor)}: No candidates found`);

        if (opts.checkResolutions) {
          const {locators} = await noLockfileResolver.getSatisfying(descriptor, resolvedDependencies, [finalResolution], {...resolveOptions, resolver: noLockfileResolver});
          if (!locators.find(locator => locator.locatorHash === finalResolution.locatorHash)) {
            throw new ReportError(MessageName.RESOLUTION_MISMATCH, `Invalid resolution ${structUtils.prettyResolution(this.configuration, descriptor, finalResolution)}`);
          }
        }

        allDescriptors.set(descriptor.descriptorHash, descriptor);
        allResolutions.set(descriptor.descriptorHash, finalResolution.locatorHash);

        return schedulePackageResolution(finalResolution);
      };

      const scheduleDescriptorResolution = (descriptor: Descriptor) => {
        const promise = descriptorResolutionPromises.get(descriptor.descriptorHash);
        if (typeof promise !== `undefined`)
          return promise;

        allDescriptors.set(descriptor.descriptorHash, descriptor);

        const newPromise = Promise.resolve().then(() => startDescriptorResolution(descriptor));
        descriptorResolutionPromises.set(descriptor.descriptorHash, newPromise);
        return newPromise;
      };

      for (const workspace of this.workspaces) {
        const workspaceDescriptor = workspace.anchoredDescriptor;
        resolutionQueue.push(scheduleDescriptorResolution(workspaceDescriptor));
      }

      while (resolutionQueue.length > 0) {
        const copy = [...resolutionQueue];
        resolutionQueue.length = 0;
        await miscUtils.allSettledSafe(copy);
      }
    });

    // What remains is a removed package
    const removedPackages: Array<Locator> = miscUtils.mapAndFilter(initialPackages.values(), pkg => {
      if (this.tryWorkspaceByLocator(pkg))
        return miscUtils.mapAndFilter.skip;

      return pkg;
    });

    if (addedPackages.length > 0 || removedPackages.length > 0) {
      const topLevelResolutions = new Set(this.workspaces.flatMap(workspace => {
        const workspacePkg = allPackages.get(workspace.anchoredLocator.locatorHash);
        if (!workspacePkg)
          throw new Error(`Assertion failed: The workspace should have been resolved`);

        return Array.from(workspacePkg.dependencies.values(), descriptor => {
          const resolution = allResolutions.get(descriptor.descriptorHash);
          if (!resolution)
            throw new Error(`Assertion failed: The resolution should have been registered`);

          return resolution;
        });
      }));

      const sortTopLevelFirst = (locator: Locator) => topLevelResolutions.has(locator.locatorHash) ? `0` : `1`;
      const sortByLocatorString = (locator: Locator) => structUtils.stringifyLocator(locator);

      const sortedAddedPackages = miscUtils.sortMap(addedPackages, [sortTopLevelFirst, sortByLocatorString]);
      const sortedRemovedPackages = miscUtils.sortMap(removedPackages, [sortTopLevelFirst, sortByLocatorString]);

      const recommendedLength = opts.report.getRecommendedLength();

      if (sortedAddedPackages.length > 0)
        opts.report.reportInfo(MessageName.UPDATED_RESOLUTION_RECORD, `${formatUtils.pretty(this.configuration, `+`, formatUtils.Type.ADDED)} ${formatUtils.prettyTruncatedLocatorList(this.configuration, sortedAddedPackages, recommendedLength)}`);

      if (sortedRemovedPackages.length > 0) {
        opts.report.reportInfo(MessageName.UPDATED_RESOLUTION_RECORD, `${formatUtils.pretty(this.configuration, `-`, formatUtils.Type.REMOVED)} ${formatUtils.prettyTruncatedLocatorList(this.configuration, sortedRemovedPackages, recommendedLength)}`);
      }
    }

    // In this step we now create virtual packages for each package with at
    // least one peer dependency. We also use it to search for the alias
    // descriptors that aren't depended upon by anything and can be safely
    // pruned.

    const volatileDescriptors = new Set(this.resolutionAliases.values());
    const optionalBuilds = new Set(allPackages.keys());
    const accessibleLocators = new Set<LocatorHash>();
    const peerRequirements: Project['peerRequirements'] = new Map();
    const peerWarnings: Project['peerWarnings'] = [];
    const peerRequirementNodes: Project['peerRequirementNodes'] = new Map();

    applyVirtualResolutionMutations({
      project: this,

      accessibleLocators,
      volatileDescriptors,
      optionalBuilds,
      peerRequirements,
      peerWarnings,
      peerRequirementNodes,

      allDescriptors,
      allResolutions,
      allPackages,
    });

    for (const locatorHash of resolutionDependencies)
      optionalBuilds.delete(locatorHash);

    // All descriptors still referenced within the volatileDescriptors set are
    // descriptors that aren't depended upon by anything in the dependency tree.

    for (const descriptorHash of volatileDescriptors) {
      allDescriptors.delete(descriptorHash);
      allResolutions.delete(descriptorHash);
    }

    const conditionalLocators = new Set<LocatorHash>();
    const disabledLocators = new Set<LocatorHash>();

    for (const pkg of allPackages.values()) {
      if (pkg.conditions == null)
        continue;

      if (!optionalBuilds.has(pkg.locatorHash))
        continue;

      if (!structUtils.isPackageCompatible(pkg, supportedArchitectures)) {
        if (structUtils.isPackageCompatible(pkg, currentArchitecture)) {
          opts.report.reportWarningOnce(MessageName.GHOST_ARCHITECTURE, `${
            structUtils.prettyLocator(this.configuration, pkg)
          }: Your current architecture (${
            process.platform
          }-${
            process.arch
          }) is supported by this package, but is missing from the ${
            formatUtils.pretty(this.configuration, `supportedArchitectures`, formatUtils.Type.SETTING)
          } setting`);
        }

        disabledLocators.add(pkg.locatorHash);
      }

      conditionalLocators.add(pkg.locatorHash);
    }

    // Everything is done, we can now update our internal resolutions to
    // reference the new ones

    this.storedResolutions = allResolutions;
    this.storedDescriptors = allDescriptors;
    this.storedPackages = allPackages;

    this.accessibleLocators = accessibleLocators;
    this.conditionalLocators = conditionalLocators;
    this.disabledLocators = disabledLocators;
    this.originalPackages = originalPackages;
    this.optionalBuilds = optionalBuilds;
    this.peerRequirements = peerRequirements;
    this.peerWarnings = peerWarnings;
    this.peerRequirementNodes = peerRequirementNodes;
  }

  async fetchEverything({cache, report, fetcher: userFetcher, mode, persistProject = true}: InstallOptions) {
    const cacheOptions = {
      mockedPackages: this.disabledLocators,
      unstablePackages: this.conditionalLocators,
    };

    const fetcher = userFetcher || this.configuration.makeFetcher();
    const fetcherOptions = {checksums: this.storedChecksums, project: this, cache, fetcher, report, cacheOptions};

    let locatorHashes = Array.from(
      new Set(
        miscUtils.sortMap(this.storedResolutions.values(), [
          (locatorHash: LocatorHash) => {
            const pkg = this.storedPackages.get(locatorHash);
            if (!pkg)
              throw new Error(`Assertion failed: The locator should have been registered`);

            return structUtils.stringifyLocator(pkg);
          },
        ]),
      ),
    );

    // In "dependency update" mode, we won't trigger the link step. As a
    // result, we only need to fetch the packages that are missing their
    // hashes (to add them to the lockfile).
    if (mode === InstallMode.UpdateLockfile)
      locatorHashes = locatorHashes.filter(locatorHash => !this.storedChecksums.has(locatorHash));

    let firstError = false;

    const progress = Report.progressViaCounter(locatorHashes.length);
    await report.reportProgress(progress);

    const limit = pLimit(FETCHER_CONCURRENCY);

    await miscUtils.allSettledSafe(locatorHashes.map(locatorHash => limit(async () => {
      const pkg = this.storedPackages.get(locatorHash);
      if (!pkg)
        throw new Error(`Assertion failed: The locator should have been registered`);

      if (structUtils.isVirtualLocator(pkg))
        return;

      let fetchResult;
      try {
        fetchResult = await fetcher.fetch(pkg, fetcherOptions);
      } catch (error) {
        error.message = `${structUtils.prettyLocator(this.configuration, pkg)}: ${error.message}`;
        report.reportExceptionOnce(error);
        firstError = error;
        return;
      }

      if (fetchResult.checksum != null)
        this.storedChecksums.set(pkg.locatorHash, fetchResult.checksum);
      else
        this.storedChecksums.delete(pkg.locatorHash);

      if (fetchResult.releaseFs) {
        fetchResult.releaseFs();
      }
    }).finally(() => {
      progress.tick();
    })));

    if (firstError)
      throw firstError;

    const cleanInfo = persistProject && mode !== InstallMode.UpdateLockfile
      ? await this.cacheCleanup({cache, report})
      : null;

    if (report.cacheMisses.size > 0 || cleanInfo) {
      const addedSizes = await Promise.all([...report.cacheMisses].map(async locatorHash => {
        const locator = this.storedPackages.get(locatorHash);
        const checksum = this.storedChecksums.get(locatorHash) ?? null;

        const p = cache.getLocatorPath(locator!, checksum);
        const stat = await xfs.statPromise(p);

        return stat.size;
      }));

      const finalSizeChange = addedSizes.reduce((sum, size) => sum + size, 0) - (cleanInfo?.size ?? 0);

      const addedCount = report.cacheMisses.size;
      const removedCount = cleanInfo?.count ?? 0;

      const addedLine = `${miscUtils.plural(addedCount, {
        zero: `No new packages`,
        one: `A package was`,
        more: `${formatUtils.pretty(this.configuration, addedCount, formatUtils.Type.NUMBER)} packages were`,
      })} added to the project`;

      const removedLine = `${miscUtils.plural(removedCount, {
        zero: `none were`,
        one: `one was`,
        more: `${formatUtils.pretty(this.configuration, removedCount, formatUtils.Type.NUMBER)} were`,
      })} removed`;

      const sizeLine = finalSizeChange !== 0
        ? ` (${formatUtils.pretty(this.configuration, finalSizeChange, formatUtils.Type.SIZE_DIFF)})`
        : ``;

      const message = removedCount > 0
        ? addedCount > 0
          ? `${addedLine}, and ${removedLine}${sizeLine}.`
          : `${addedLine}, but ${removedLine}${sizeLine}.`
        : `${addedLine}${sizeLine}.`;

      report.reportInfo(MessageName.FETCH_NOT_CACHED, message);
    }
  }

  async linkEverything({cache, report, fetcher: optFetcher, mode}: InstallOptions) {
    const cacheOptions: CacheOptions = {
      mockedPackages: this.disabledLocators,
      unstablePackages: this.conditionalLocators,
      skipIntegrityCheck: true,
    };

    const fetcher = optFetcher || this.configuration.makeFetcher();
    const fetcherOptions: FetchOptions = {checksums: this.storedChecksums, project: this, cache, fetcher, report, cacheOptions};

    const linkers = this.configuration.getLinkers();
    const linkerOptions: LinkOptions = {project: this, report};

    const installers = new Map(linkers.map(linker => {
      const installer = linker.makeInstaller(linkerOptions);

      const customDataKey = linker.getCustomDataKey();
      const customData = this.linkersCustomData.get(customDataKey);
      if (typeof customData !== `undefined`)
        installer.attachCustomData(customData);

      return [linker, installer] as [Linker, Installer];
    }));

    const packageLinkers: Map<LocatorHash, Linker> = new Map();
    const packageLocations: Map<LocatorHash, PortablePath | null> = new Map();

    const packageBuildDirectives: Map<LocatorHash, {
      buildDirectives: Array<BuildDirective>;
      buildLocations: Array<PortablePath>;
    }> = new Map();

    const fetchResultsPerPackage = new Map(await miscUtils.allSettledSafe([...this.accessibleLocators].map(async locatorHash => {
      const pkg = this.storedPackages.get(locatorHash);
      if (!pkg)
        throw new Error(`Assertion failed: The locator should have been registered`);

      return [locatorHash, await fetcher.fetch(pkg, fetcherOptions)] as const;
    })));

    const pendingPromises: Array<Promise<void>> = [];

    const nextSkippedBuilds = new Set<LocatorHash>();
    const skippedBuildLogs: Array<[Locator, (report: Report) => void]> = [];

    // Step 1: Installing the packages on the disk

    for (const locatorHash of this.accessibleLocators) {
      const pkg = this.storedPackages.get(locatorHash);
      if (typeof pkg === `undefined`)
        throw new Error(`Assertion failed: The locator should have been registered`);

      const fetchResult = fetchResultsPerPackage.get(pkg.locatorHash);
      if (typeof fetchResult === `undefined`)
        throw new Error(`Assertion failed: The fetch result should have been registered`);

      const holdPromises: Array<Promise<void>> = [];
      const holdFetchResult = (promise: Promise<void>) => {
        holdPromises.push(promise);
      };

      const workspace = this.tryWorkspaceByLocator(pkg);
      if (workspace !== null) {
        const buildDirectives: Array<BuildDirective> = [];
        const {scripts} = workspace.manifest;

        for (const scriptName of [`preinstall`, `install`, `postinstall`])
          if (scripts.has(scriptName))
            buildDirectives.push({type: BuildDirectiveType.SCRIPT, script: scriptName});

        try {
          for (const [linker, installer] of installers) {
            if (linker.supportsPackage(pkg, linkerOptions)) {
              const result = await installer.installPackage(pkg, fetchResult, {holdFetchResult});
              if (result.buildRequest !== null) {
                throw new Error(`Assertion failed: Linkers can't return build directives for workspaces; this responsibility befalls to the Yarn core`);
              }
            }
          }
        } finally {
          if (holdPromises.length === 0) {
            fetchResult.releaseFs?.();
          } else {
            pendingPromises.push(miscUtils.allSettledSafe(holdPromises).catch(() => {}).then(() => {
              fetchResult.releaseFs?.();
            }));
          }
        }

        const location = ppath.join(fetchResult.packageFs.getRealPath(), fetchResult.prefixPath);
        packageLocations.set(pkg.locatorHash, location);

        // Virtual workspaces shouldn't be built as they don't really exist
        if (!structUtils.isVirtualLocator(pkg) && buildDirectives.length > 0) {
          packageBuildDirectives.set(pkg.locatorHash, {
            buildDirectives,
            buildLocations: [location],
          });
        }
      } else {
        const linker = linkers.find(linker => linker.supportsPackage(pkg, linkerOptions));
        if (!linker)
          throw new ReportError(MessageName.LINKER_NOT_FOUND, `${structUtils.prettyLocator(this.configuration, pkg)} isn't supported by any available linker`);

        const installer = installers.get(linker);
        if (!installer)
          throw new Error(`Assertion failed: The installer should have been registered`);

        let installStatus: InstallStatus;
        try {
          installStatus = await installer.installPackage(pkg, fetchResult, {holdFetchResult});
        } finally {
          if (holdPromises.length === 0) {
            fetchResult.releaseFs?.();
          } else {
            pendingPromises.push(miscUtils.allSettledSafe(holdPromises).then(() => {}).then(() => {
              fetchResult.releaseFs?.();
            }));
          }
        }

        packageLinkers.set(pkg.locatorHash, linker);
        packageLocations.set(pkg.locatorHash, installStatus.packageLocation);

        if (installStatus.buildRequest && installStatus.packageLocation) {
          if (installStatus.buildRequest.skipped) {
            nextSkippedBuilds.add(pkg.locatorHash);
            if (!this.skippedBuilds.has(pkg.locatorHash)) {
              skippedBuildLogs.push([pkg, installStatus.buildRequest.explain]);
            }
          } else {
            packageBuildDirectives.set(pkg.locatorHash, {
              buildDirectives: installStatus.buildRequest.directives,
              buildLocations: [installStatus.packageLocation],
            });
          }
        }
      }
    }

    // Step 2: Link packages together

    const externalDependents: Map<LocatorHash, Array<PortablePath>> = new Map();

    for (const locatorHash of this.accessibleLocators) {
      const pkg = this.storedPackages.get(locatorHash);
      if (!pkg)
        throw new Error(`Assertion failed: The locator should have been registered`);

      const isWorkspace = this.tryWorkspaceByLocator(pkg) !== null;

      const linkPackage = async (packageLinker: Linker, installer: Installer) => {
        const packageLocation = packageLocations.get(pkg.locatorHash);
        if (typeof packageLocation === `undefined`)
          throw new Error(`Assertion failed: The package (${structUtils.prettyLocator(this.configuration, pkg)}) should have been registered`);

        const internalDependencies = [];

        for (const descriptor of pkg.dependencies.values()) {
          const resolution = this.storedResolutions.get(descriptor.descriptorHash);
          if (typeof resolution === `undefined`)
            throw new Error(`Assertion failed: The resolution (${structUtils.prettyDescriptor(this.configuration, descriptor)}, from ${structUtils.prettyLocator(this.configuration, pkg)})should have been registered`);

          const dependency = this.storedPackages.get(resolution);
          if (typeof dependency === `undefined`)
            throw new Error(`Assertion failed: The package (${resolution}, resolved from ${structUtils.prettyDescriptor(this.configuration, descriptor)}) should have been registered`);

          const dependencyLinker = this.tryWorkspaceByLocator(dependency) === null
            ? packageLinkers.get(resolution)
            : null;

          if (typeof dependencyLinker === `undefined`)
            throw new Error(`Assertion failed: The package (${resolution}, resolved from ${structUtils.prettyDescriptor(this.configuration, descriptor)}) should have been registered`);

          const isWorkspaceDependency = dependencyLinker === null;

          if (dependencyLinker === packageLinker || isWorkspaceDependency) {
            if (packageLocations.get(dependency.locatorHash) !== null) {
              internalDependencies.push([descriptor, dependency] as [Descriptor, Locator]);
            }
          } else if (!isWorkspace && packageLocation !== null) {
            const externalEntry = miscUtils.getArrayWithDefault(externalDependents, resolution);
            externalEntry.push(packageLocation);
          }
        }

        if (packageLocation !== null) {
          await installer.attachInternalDependencies(pkg, internalDependencies);
        }
      };

      if (isWorkspace) {
        for (const [packageLinker, installer] of installers) {
          if (packageLinker.supportsPackage(pkg, linkerOptions)) {
            await linkPackage(packageLinker, installer);
          }
        }
      } else {
        const packageLinker = packageLinkers.get(pkg.locatorHash);
        if (!packageLinker)
          throw new Error(`Assertion failed: The linker should have been found`);

        const installer = installers.get(packageLinker!);
        if (!installer)
          throw new Error(`Assertion failed: The installer should have been registered`);

        await linkPackage(packageLinker, installer);
      }
    }

    for (const [locatorHash, dependentPaths] of externalDependents) {
      const pkg = this.storedPackages.get(locatorHash);
      if (!pkg)
        throw new Error(`Assertion failed: The package should have been registered`);

      const packageLinker = packageLinkers.get(pkg.locatorHash);
      if (!packageLinker)
        throw new Error(`Assertion failed: The linker should have been found`);

      const installer = installers.get(packageLinker);
      if (!installer)
        throw new Error(`Assertion failed: The installer should have been registered`);

      await installer.attachExternalDependents(pkg, dependentPaths);
    }

    // Step 3: Inform our linkers that they should have all the info needed

    const linkersCustomData = new Map();

    for (const [linker, installer] of installers) {
      const finalizeInstallData = await installer.finalizeInstall();

      for (const installStatus of finalizeInstallData?.records ?? []) {
        if (installStatus.buildRequest.skipped) {
          nextSkippedBuilds.add(installStatus.locator.locatorHash);
          if (!this.skippedBuilds.has(installStatus.locator.locatorHash)) {
            skippedBuildLogs.push([installStatus.locator, installStatus.buildRequest.explain]);
          }
        } else {
          packageBuildDirectives.set(installStatus.locator.locatorHash, {
            buildDirectives: installStatus.buildRequest.directives,
            buildLocations: installStatus.buildLocations,
          });
        }
      }

      if (typeof finalizeInstallData?.customData !== `undefined`) {
        linkersCustomData.set(linker.getCustomDataKey(), finalizeInstallData.customData);
      }
    }

    this.linkersCustomData = linkersCustomData;

    await miscUtils.allSettledSafe(pendingPromises);

    // Step 4: Build the packages in multiple steps

    if (mode === InstallMode.SkipBuild)
      return;

    for (const [, explain] of miscUtils.sortMap(skippedBuildLogs, ([locator]) => structUtils.stringifyLocator(locator)))
      explain(report);

    const readyPackages = new Set(this.storedPackages.keys());
    const buildablePackages = new Set(packageBuildDirectives.keys());

    for (const locatorHash of buildablePackages)
      readyPackages.delete(locatorHash);

    const globalHashGenerator = createHash(`sha512`);
    globalHashGenerator.update(process.versions.node);

    await this.configuration.triggerHook(hooks => {
      return hooks.globalHashGeneration;
    }, this, (data: Buffer | string) => {
      globalHashGenerator.update(`\0`);
      globalHashGenerator.update(data);
    });

    const globalHash = globalHashGenerator.digest(`hex`);
    const packageHashMap = new Map<LocatorHash, string>();

    // We'll use this function is order to compute a hash for each package
    // that exposes a build directive. If the hash changes compared to the
    // previous run, the package is rebuilt. This has the advantage of making
    // the rebuilds much more predictable than before, and to give us the tools
    // later to improve this further by explaining *why* a rebuild happened.

    const getBaseHash = (locator: Locator) => {
      let hash = packageHashMap.get(locator.locatorHash);
      if (typeof hash !== `undefined`)
        return hash;

      const pkg = this.storedPackages.get(locator.locatorHash);
      if (typeof pkg === `undefined`)
        throw new Error(`Assertion failed: The package should have been registered`);

      const builder = createHash(`sha512`);
      builder.update(locator.locatorHash);

      // To avoid the case where one dependency depends on itself somehow
      packageHashMap.set(locator.locatorHash, `<recursive>`);

      for (const descriptor of pkg.dependencies.values()) {
        const resolution = this.storedResolutions.get(descriptor.descriptorHash);
        if (typeof resolution === `undefined`)
          throw new Error(`Assertion failed: The resolution (${structUtils.prettyDescriptor(this.configuration, descriptor)}) should have been registered`);

        const dependency = this.storedPackages.get(resolution);
        if (typeof dependency === `undefined`)
          throw new Error(`Assertion failed: The package should have been registered`);

        builder.update(getBaseHash(dependency));
      }

      hash = builder.digest(`hex`);
      packageHashMap.set(locator.locatorHash, hash);

      return hash;
    };

    const getBuildHash = (locator: Locator, buildLocations: Array<PortablePath>) => {
      const builder = createHash(`sha512`);

      builder.update(globalHash);
      builder.update(getBaseHash(locator));

      for (const location of buildLocations)
        builder.update(location);

      return builder.digest(`hex`);
    };

    // We reconstruct the build state from an empty object because we want to
    // remove the state from packages that got removed
    const nextBState = new Map<LocatorHash, string>();

    let isInstallStatePersisted = false;

    const isLocatorBuildable = (locator: Locator) => {
      const hashesToCheck = new Set([locator.locatorHash]);

      for (const locatorHash of hashesToCheck) {
        const pkg = this.storedPackages.get(locatorHash);
        if (!pkg)
          throw new Error(`Assertion failed: The package should have been registered`);

        for (const dependency of pkg.dependencies.values()) {
          const resolution = this.storedResolutions.get(dependency.descriptorHash);
          if (!resolution)
            throw new Error(`Assertion failed: The resolution (${structUtils.prettyDescriptor(this.configuration, dependency)}) should have been registered`);

          if (resolution !== locator.locatorHash && buildablePackages.has(resolution))
            return false;

          // Virtual workspaces don't have build scripts but the original might so we need to check it.
          const dependencyPkg = this.storedPackages.get(resolution);
          if (!dependencyPkg)
            throw new Error(`Assertion failed: The package should have been registered`);

          const workspace = this.tryWorkspaceByLocator(dependencyPkg);
          if (workspace) {
            if (workspace.anchoredLocator.locatorHash !== locator.locatorHash && buildablePackages.has(workspace.anchoredLocator.locatorHash))
              return false;

            hashesToCheck.add(workspace.anchoredLocator.locatorHash);
          }

          hashesToCheck.add(resolution);
        }
      }

      return true;
    };

    while (buildablePackages.size > 0) {
      const savedSize = buildablePackages.size;
      const buildPromises: Array<Promise<unknown>> = [];

      for (const locatorHash of buildablePackages) {
        const pkg = this.storedPackages.get(locatorHash);
        if (!pkg)
          throw new Error(`Assertion failed: The package should have been registered`);

        // Wait until all dependencies of the current package have been built
        // before trying to build it (since it might need them to build itself)
        if (!isLocatorBuildable(pkg))
          continue;

        const buildInfo = packageBuildDirectives.get(pkg.locatorHash);
        if (!buildInfo)
          throw new Error(`Assertion failed: The build directive should have been registered`);

        const buildHash = getBuildHash(pkg, buildInfo.buildLocations);

        // No need to rebuild the package if its hash didn't change
        if (this.storedBuildState.get(pkg.locatorHash) === buildHash) {
          nextBState.set(pkg.locatorHash, buildHash);
          buildablePackages.delete(locatorHash);
          continue;
        }

        // The install state is persisted after the builds finish (because it
        // contains the build state), but if we need to run builds then we
        // also need it to be written before the builds (since the build
        // scripts will need it to run).
        if (!isInstallStatePersisted) {
          await this.persistInstallStateFile();
          isInstallStatePersisted = true;
        }

        if (this.storedBuildState.has(pkg.locatorHash))
          report.reportInfo(MessageName.MUST_REBUILD, `${structUtils.prettyLocator(this.configuration, pkg)} must be rebuilt because its dependency tree changed`);
        else
          report.reportInfo(MessageName.MUST_BUILD, `${structUtils.prettyLocator(this.configuration, pkg)} must be built because it never has been before or the last one failed`);

        const pkgBuilds = buildInfo.buildLocations.map(async location => {
          if (!ppath.isAbsolute(location))
            throw new Error(`Assertion failed: Expected the build location to be absolute (not ${location})`);

          for (const directive of buildInfo.buildDirectives) {
            let header = `# This file contains the result of Yarn building a package (${structUtils.stringifyLocator(pkg)})\n`;
            switch (directive.type) {
              case BuildDirectiveType.SCRIPT: {
                header += `# Script name: ${directive.script}\n`;
              } break;
              case BuildDirectiveType.SHELLCODE: {
                header += `# Script code: ${directive.script}\n`;
              } break;
            }

            const stdin = null;

            const wasBuildSuccessful = await xfs.mktempPromise(async logDir => {
              const logFile = ppath.join(logDir, `build.log`);

              const {stdout, stderr} = this.configuration.getSubprocessStreams(logFile, {
                header,
                prefix: structUtils.prettyLocator(this.configuration, pkg),
                report,
              });

              let exitCode;
              try {
                switch (directive.type) {
                  case BuildDirectiveType.SCRIPT: {
                    exitCode = await scriptUtils.executePackageScript(pkg, directive.script, [], {cwd: location, project: this, stdin, stdout, stderr});
                  } break;
                  case BuildDirectiveType.SHELLCODE: {
                    exitCode = await scriptUtils.executePackageShellcode(pkg, directive.script, [], {cwd: location, project: this, stdin, stdout, stderr});
                  } break;
                }
              } catch (error) {
                stderr.write(error.stack);
                exitCode = 1;
              }

              stdout.end();
              stderr.end();

              if (exitCode === 0)
                return true;

              xfs.detachTemp(logDir);

              const buildMessage = `${structUtils.prettyLocator(this.configuration, pkg)} couldn't be built successfully (exit code ${formatUtils.pretty(this.configuration, exitCode, formatUtils.Type.NUMBER)}, logs can be found here: ${formatUtils.pretty(this.configuration, logFile, formatUtils.Type.PATH)})`;
              const isOptional = this.optionalBuilds.has(pkg.locatorHash);

              if (isOptional)
                report.reportInfo(MessageName.BUILD_FAILED, buildMessage);
              else
                report.reportError(MessageName.BUILD_FAILED, buildMessage);

              // Sync, because the rendering would end up messed up if other
              // builds were processed before the file read succeeded.
              if (SUPPORTS_GROUPS)
                report.reportFold(npath.fromPortablePath(logFile), xfs.readFileSync(logFile, `utf8`));


              return isOptional;
            });

            if (!wasBuildSuccessful) {
              return false;
            }
          }

          return true;
        });

        buildPromises.push(
          ...pkgBuilds,
          Promise.allSettled(pkgBuilds).then(results => {
            buildablePackages.delete(locatorHash);

            if (results.every(result => result.status === `fulfilled` && result.value === true)) {
              nextBState.set(pkg.locatorHash, buildHash);
            }
          }),
        );
      }

      await miscUtils.allSettledSafe(buildPromises);

      // If we reach this code, it means that we have circular dependencies
      // somewhere. Worst, it means that the circular dependencies both have
      // build scripts, making them unsatisfiable.

      if (savedSize === buildablePackages.size) {
        const prettyLocators = Array.from(buildablePackages).map(locatorHash => {
          const pkg = this.storedPackages.get(locatorHash);
          if (!pkg)
            throw new Error(`Assertion failed: The package should have been registered`);

          return structUtils.prettyLocator(this.configuration, pkg);
        }).join(`, `);

        report.reportError(MessageName.CYCLIC_DEPENDENCIES, `Some packages have circular dependencies that make their build order unsatisfiable - as a result they won't be built (affected packages are: ${prettyLocators})`);
        break;
      }
    }

    // We can now update the storedBuildState, which will allow us to "remember"
    // what's the dependency tree subset that we used to build a specific
    // package (and avoid rebuilding it later if it didn't change).

    this.storedBuildState = nextBState;
    this.skippedBuilds = nextSkippedBuilds;
  }

  async installWithNewReport(reportOpts: {json?: boolean, quiet?: boolean, stdout: internal.Writable}, installOpts: Omit<InstallOptions, `report`>) {
    const report = await StreamReport.start({
      configuration: this.configuration,
      json: reportOpts.json,
      stdout: reportOpts.stdout,
      forceSectionAlignment: true,
      includeLogs: !reportOpts.json && !reportOpts.quiet,
      includeVersion: true,
    }, async report => {
      await this.install({...installOpts, report});
    });

    return report.exitCode();
  }

  async install(opts: InstallOptions) {
    const nodeLinker = this.configuration.get(`nodeLinker`);
    Configuration.telemetry?.reportInstall(nodeLinker);

    let hasPreErrors = false;
    await opts.report.startTimerPromise(`Project validation`, {
      skipIfEmpty: true,
    }, async () => {
      if (this.configuration.get(`enableOfflineMode`))
        opts.report.reportWarning(MessageName.OFFLINE_MODE_ENABLED, `Offline work is enabled; Yarn won't fetch packages from the remote registry if it can avoid it`);

      await this.configuration.triggerHook(hooks => {
        return hooks.validateProject;
      }, this, {
        reportWarning: (name, text) => {
          opts.report.reportWarning(name, text);
        },
        reportError: (name, text) => {
          opts.report.reportError(name, text);
          hasPreErrors = true;
        },
      });
    });

    if (hasPreErrors)
      return;

    const packageExtensions = await this.configuration.getPackageExtensions();

    for (const extensionsByIdent of packageExtensions.values())
      for (const [, extensionsByRange] of extensionsByIdent)
        for (const extension of extensionsByRange)
          extension.status = PackageExtensionStatus.Inactive;

    const lockfilePath = ppath.join(this.cwd, Filename.lockfile);

    // If we operate with a frozen lockfile, we take a snapshot of it to later make sure it didn't change
    let initialLockfile: string | null = null;
    if (opts.immutable) {
      try {
        initialLockfile = await xfs.readFilePromise(lockfilePath, `utf8`);
      } catch (error) {
        if (error.code === `ENOENT`) {
          throw new ReportError(MessageName.FROZEN_LOCKFILE_EXCEPTION, `The lockfile would have been created by this install, which is explicitly forbidden.`);
        } else {
          throw error;
        }
      }
    }

    await opts.report.startTimerPromise(`Resolution step`, async () => {
      await this.resolveEverything(opts);
    });

    await opts.report.startTimerPromise(`Post-resolution validation`, {
      skipIfEmpty: true,
    }, async () => {
      emitPeerDependencyWarnings(this, opts.report);

      for (const [, extensionsPerRange] of packageExtensions) {
        for (const [, extensions] of extensionsPerRange) {
          for (const extension of extensions) {
            if (extension.userProvided) {
              const prettyPackageExtension = formatUtils.pretty(this.configuration, extension, formatUtils.Type.PACKAGE_EXTENSION);

              switch (extension.status) {
                case PackageExtensionStatus.Inactive: {
                  opts.report.reportWarning(MessageName.UNUSED_PACKAGE_EXTENSION, `${prettyPackageExtension}: No matching package in the dependency tree; you may not need this rule anymore.`);
                } break;

                case PackageExtensionStatus.Redundant: {
                  opts.report.reportWarning(MessageName.REDUNDANT_PACKAGE_EXTENSION, `${prettyPackageExtension}: This rule seems redundant when applied on the original package; the extension may have been applied upstream.`);
                } break;
              }
            }
          }
        }
      }

      if (initialLockfile !== null) {
        const newLockfile = normalizeLineEndings(initialLockfile, this.generateLockfile());

        if (newLockfile !== initialLockfile) {
          // @ts-expect-error 2345 need to upgrade to diff 5.0.1 or apply patch in yarn's monorepo
          const diff = structuredPatch(lockfilePath, lockfilePath, initialLockfile, newLockfile, undefined, undefined, {maxEditLength: 100});

          if (diff) {
            opts.report.reportSeparator();

            for (const hunk of diff.hunks) {
              opts.report.reportInfo(null, `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`);
              for (const line of hunk.lines) {
                if (line.startsWith(`+`)) {
                  opts.report.reportError(MessageName.FROZEN_LOCKFILE_EXCEPTION, formatUtils.pretty(this.configuration, line, formatUtils.Type.ADDED));
                } else if (line.startsWith(`-`)) {
                  opts.report.reportError(MessageName.FROZEN_LOCKFILE_EXCEPTION, formatUtils.pretty(this.configuration, line, formatUtils.Type.REMOVED));
                } else {
                  opts.report.reportInfo(null, formatUtils.pretty(this.configuration, line, `grey`));
                }
              }
            }

            opts.report.reportSeparator();
          }

          throw new ReportError(MessageName.FROZEN_LOCKFILE_EXCEPTION, `The lockfile would have been modified by this install, which is explicitly forbidden.`);
        }
      }
    });

    for (const extensionsByIdent of packageExtensions.values())
      for (const [, extensionsByRange] of extensionsByIdent)
        for (const extension of extensionsByRange)
          if (extension.userProvided && extension.status === PackageExtensionStatus.Active)
            Configuration.telemetry?.reportPackageExtension(formatUtils.json(extension, formatUtils.Type.PACKAGE_EXTENSION));

    await opts.report.startTimerPromise(`Fetch step`, async () => {
      await this.fetchEverything(opts);
    });

    const immutablePatterns = opts.immutable
      ? [...new Set(this.configuration.get(`immutablePatterns`))].sort()
      : [];

    const before = await Promise.all(immutablePatterns.map(async pattern => {
      return hashUtils.checksumPattern(pattern, {cwd: this.cwd});
    }));

    if (typeof opts.persistProject === `undefined` || opts.persistProject)
      await this.persist();

    await opts.report.startTimerPromise(`Link step`, async () => {
      if (opts.mode === InstallMode.UpdateLockfile) {
        opts.report.reportWarning(MessageName.UPDATE_LOCKFILE_ONLY_SKIP_LINK, `Skipped due to ${formatUtils.pretty(this.configuration, `mode=update-lockfile`, formatUtils.Type.CODE)}`);
        return;
      }

      await this.linkEverything(opts);

      const after = await Promise.all(immutablePatterns.map(async pattern => {
        return hashUtils.checksumPattern(pattern, {cwd: this.cwd});
      }));

      for (let t = 0; t < immutablePatterns.length; ++t) {
        if (before[t] !== after[t]) {
          opts.report.reportError(MessageName.FROZEN_ARTIFACT_EXCEPTION, `The checksum for ${immutablePatterns[t]} has been modified by this install, which is explicitly forbidden.`);
        }
      }
    });

    await this.persistInstallStateFile();

    let hasPostErrors = false;
    await opts.report.startTimerPromise(`Post-install validation`, {
      skipIfEmpty: true,
    }, async () => {
      await this.configuration.triggerHook(hooks => {
        return hooks.validateProjectAfterInstall;
      }, this, {
        reportWarning: (name, text) => {
          opts.report.reportWarning(name, text);
        },
        reportError: (name, text) => {
          opts.report.reportError(name, text);
          hasPostErrors = true;
        },
      });
    });

    if (hasPostErrors)
      return;

    await this.configuration.triggerHook(hooks => {
      return hooks.afterAllInstalled;
    }, this, opts);
  }

  generateLockfile() {
    // We generate the data structure that will represent our lockfile. To do this, we create a
    // reverse lookup table, where the key will be the resolved locator and the value will be a set
    // of all the descriptors that resolved to it. Then we use it to construct an optimized version
    // if the final object.
    const reverseLookup = new Map<LocatorHash, Set<DescriptorHash>>();

    for (const [descriptorHash, locatorHash] of this.storedResolutions.entries()) {
      let descriptorHashes = reverseLookup.get(locatorHash);
      if (!descriptorHashes)
        reverseLookup.set(locatorHash, descriptorHashes = new Set());

      descriptorHashes.add(descriptorHash);
    }

    const optimizedLockfile: {[key: string]: any} = {};

    const {cacheKey} = Cache.getCacheKey(this.configuration);

    optimizedLockfile.__metadata = {
      version: LOCKFILE_VERSION,
      cacheKey,
    };

    for (const [locatorHash, descriptorHashes] of reverseLookup.entries()) {
      const pkg = this.originalPackages.get(locatorHash);

      // A resolution that isn't in `originalPackages` is a virtual packages.
      // Since virtual packages can be derived from the information stored in
      // the rest of the lockfile we don't want to bother storing them.
      if (!pkg)
        continue;

      const descriptors = [];

      for (const descriptorHash of descriptorHashes) {
        const descriptor = this.storedDescriptors.get(descriptorHash);
        if (!descriptor)
          throw new Error(`Assertion failed: The descriptor should have been registered`);

        descriptors.push(descriptor);
      }

      const key = descriptors.map(descriptor => {
        return structUtils.stringifyDescriptor(descriptor);
      }).sort().join(`, `);

      const manifest = new Manifest();

      manifest.version = pkg.linkType === LinkType.HARD
        ? pkg.version
        : `0.0.0-use.local`;

      manifest.languageName = pkg.languageName;

      manifest.dependencies = new Map(pkg.dependencies);
      manifest.peerDependencies = new Map(pkg.peerDependencies);

      manifest.dependenciesMeta = new Map(pkg.dependenciesMeta);
      manifest.peerDependenciesMeta = new Map(pkg.peerDependenciesMeta);

      manifest.bin = new Map(pkg.bin);

      optimizedLockfile[key] = {
        ...manifest.exportTo({}, {
          compatibilityMode: false,
        }),

        linkType: pkg.linkType.toLowerCase(),

        resolution: structUtils.stringifyLocator(pkg),
        checksum: this.storedChecksums.get(pkg.locatorHash),

        conditions: pkg.conditions || undefined,
      };
    }

    const header = `${[
      `# This file is generated by running "yarn install" inside your project.\n`,
      `# Manual changes might be lost - proceed with caution!\n`,
    ].join(``)}\n`;

    return header + stringifySyml(optimizedLockfile);
  }

  async persistLockfile() {
    const lockfilePath = ppath.join(this.cwd, Filename.lockfile);

    let currentContent = ``;
    try {
      currentContent = await xfs.readFilePromise(lockfilePath, `utf8`);
    } catch (error) {
      // ignore errors, no big deal
    }

    const newContent = this.generateLockfile();
    const normalizedContent = normalizeLineEndings(currentContent, newContent);
    if (normalizedContent === currentContent)
      return;

    await xfs.writeFilePromise(lockfilePath, normalizedContent);

    this.lockFileChecksum = makeLockfileChecksum(normalizedContent);
    this.lockfileNeedsRefresh = false;
  }

  async persistInstallStateFile() {
    const fields = [];
    for (const category of Object.values(INSTALL_STATE_FIELDS))
      fields.push(...category);

    const installState = pick(this, fields) as InstallState;
    const serializedState = v8.serialize(installState);
    const newInstallStateChecksum = hashUtils.makeHash(serializedState);
    if (this.installStateChecksum === newInstallStateChecksum)
      return;

    const installStatePath = this.configuration.get(`installStatePath`);

    await xfs.mkdirPromise(ppath.dirname(installStatePath), {recursive: true});
    await xfs.writeFilePromise(installStatePath, await gzip(serializedState) as Buffer);

    this.installStateChecksum = newInstallStateChecksum;
  }

  async restoreInstallState({restoreLinkersCustomData = true, restoreResolutions = true, restoreBuildState = true}: RestoreInstallStateOpts = {}) {
    const installStatePath = this.configuration.get(`installStatePath`);

    let installState: InstallState;
    try {
      const installStateBuffer = await gunzip(await xfs.readFilePromise(installStatePath)) as Buffer;
      installState = v8.deserialize(installStateBuffer);
      this.installStateChecksum = hashUtils.makeHash(installStateBuffer);
    } catch {
      // If for whatever reason the install state can't be restored
      // carry on as if it doesn't exist.
      if (restoreResolutions)
        await this.applyLightResolution();
      return;
    }

    if (restoreLinkersCustomData)
      if (typeof installState.linkersCustomData !== `undefined`)
        this.linkersCustomData = installState.linkersCustomData;

    if (restoreBuildState)
      Object.assign(this, pick(installState, INSTALL_STATE_FIELDS.restoreBuildState));

    // Resolutions needs to be restored last otherwise applyLightResolution will persist a new state
    // before the rest is restored
    if (restoreResolutions) {
      if (installState.lockFileChecksum === this.lockFileChecksum) {
        Object.assign(this, pick(installState, INSTALL_STATE_FIELDS.restoreResolutions));
      } else {
        await this.applyLightResolution();
      }
    }
  }

  async applyLightResolution() {
    await this.resolveEverything({
      lockfileOnly: true,
      report: new ThrowReport(),
    });

    await this.persistInstallStateFile();
  }

  async persist() {
    const limit = pLimit(4);
    await Promise.all([
      this.persistLockfile(),
      ...this.workspaces.map(workspace => {
        return limit(() => workspace.persistManifest());
      }),
    ]);
  }

  async cacheCleanup({cache, report}: Pick<InstallOptions, `cache` | `report`>)  {
    if (this.configuration.get(`enableGlobalCache`))
      return null;

    const PRESERVED_FILES = new Set([
      `.gitignore`,
    ]);

    if (!isFolderInside(cache.cwd, this.cwd))
      return null;

    if (!(await xfs.existsPromise(cache.cwd)))
      return null;

    const cleanupPromises: Array<Promise<number>> = [];
    for (const entry of await xfs.readdirPromise(cache.cwd)) {
      if (PRESERVED_FILES.has(entry))
        continue;

      const entryPath = ppath.resolve(cache.cwd, entry);
      if (cache.markedFiles.has(entryPath))
        continue;

      if (cache.immutable) {
        report.reportError(MessageName.IMMUTABLE_CACHE, `${formatUtils.pretty(this.configuration, ppath.basename(entryPath), `magenta`)} appears to be unused and would be marked for deletion, but the cache is immutable`);
      } else {
        cleanupPromises.push(xfs.lstatPromise(entryPath).then(async stat => {
          await xfs.removePromise(entryPath);
          return stat.size;
        }));
      }
    }

    if (cleanupPromises.length === 0)
      return null;

    const sizes = await Promise.all(cleanupPromises);

    return {
      count: cleanupPromises.length,
      size: sizes.reduce((sum, size) => sum + size, 0),
    };
  }
}

/**
 * This function is worth some documentation. It takes a set of packages,
 * traverses them all, and generates virtual packages for each package that
 * lists peer dependencies.
 *
 * We also take advantage of the tree traversal to detect which packages are
 * actually used and which have disappeared, and to know which packages truly
 * have an optional build (since a package may be optional in one part of the
 * tree but not another).
 */
function applyVirtualResolutionMutations({
  project,

  allDescriptors,
  allResolutions,
  allPackages,

  accessibleLocators = new Set(),
  optionalBuilds = new Set(),
  peerRequirements = new Map(),
  peerWarnings = [],
  peerRequirementNodes = new Map(),
  volatileDescriptors = new Set(),
}: {
  project: Project;

  allDescriptors: Map<DescriptorHash, Descriptor>;
  allResolutions: Map<DescriptorHash, LocatorHash>;
  allPackages: Map<LocatorHash, Package>;

  accessibleLocators?: Set<LocatorHash>;
  optionalBuilds?: Set<LocatorHash>;
  peerRequirements?: Project['peerRequirements'];
  peerWarnings?: Project['peerWarnings'];
  peerRequirementNodes?: Project['peerRequirementNodes'];
  volatileDescriptors?: Set<DescriptorHash>;
}) {
  const virtualStack = new Map<LocatorHash, number>();
  const resolutionStack: Array<Locator> = [];

  const allIdents = new Map<IdentHash, Ident>();

  // We'll be keeping track of all virtual descriptors; once they have all
  // been generated we'll check whether they can be deduplicated into one.
  const allVirtualInstances = new Map<LocatorHash, Map<string, Descriptor>>();
  const allVirtualDependents = new Map<DescriptorHash, Set<LocatorHash>>();

  const allPeerRequests = new Map<LocatorHash, Map<IdentHash, PeerRequestNode>>();

  // We must keep a copy of the workspaces original dependencies, because they
  // may be overridden during the virtual package resolution - cf Dragon Test #5
  const originalWorkspaceDefinitions = new Map<LocatorHash, Package | null>(project.workspaces.map(workspace => {
    const locatorHash = workspace.anchoredLocator.locatorHash;

    const pkg = allPackages.get(locatorHash);
    if (typeof pkg === `undefined`)
      throw new Error(`Assertion failed: The workspace should have an associated package`);

    return [locatorHash, structUtils.copyPackage(pkg)];
  }));

  const reportStackOverflow = (): never => {
    const logDir = xfs.mktempSync();
    const logFile = ppath.join(logDir, `stacktrace.log`);

    const maxSize = String(resolutionStack.length + 1).length;
    const content = resolutionStack.map((locator, index) => {
      const prefix = `${index + 1}.`.padStart(maxSize, ` `);
      return `${prefix} ${structUtils.stringifyLocator(locator)}\n`;
    }).join(``);

    xfs.writeFileSync(logFile, content);

    xfs.detachTemp(logDir);
    throw new ReportError(MessageName.STACK_OVERFLOW_RESOLUTION, `Encountered a stack overflow when resolving peer dependencies; cf ${npath.fromPortablePath(logFile)}`);
  };

  const getPackageFromDescriptor = (descriptor: Descriptor): Package => {
    const resolution = allResolutions.get(descriptor.descriptorHash);
    if (typeof resolution === `undefined`)
      throw new Error(`Assertion failed: The resolution should have been registered`);

    const pkg = allPackages.get(resolution);
    if (!pkg)
      throw new Error(`Assertion failed: The package could not be found`);

    return pkg;
  };

  const resolvePeerDependencies = (parentDescriptor: Descriptor, parentLocator: Locator, parentPeerRequests: Map<IdentHash, PeerRequestNode>, {top, optional}: {top: LocatorHash, optional: boolean}) => {
    if (resolutionStack.length > 1000)
      reportStackOverflow();

    resolutionStack.push(parentLocator);
    const result = resolvePeerDependenciesImpl(parentDescriptor, parentLocator, parentPeerRequests, {top, optional});
    resolutionStack.pop();

    return result;
  };

  const resolvePeerDependenciesImpl = (parentDescriptor: Descriptor, parentLocator: Locator, parentPeerRequests: Map<IdentHash, PeerRequestNode>, {top, optional}: {top: LocatorHash, optional: boolean}) => {
    if (!optional)
      optionalBuilds.delete(parentLocator.locatorHash);

    if (accessibleLocators.has(parentLocator.locatorHash))
      return;

    accessibleLocators.add(parentLocator.locatorHash);

    const parentPackage = allPackages.get(parentLocator.locatorHash);
    if (!parentPackage)
      throw new Error(`Assertion failed: The package (${structUtils.prettyLocator(project.configuration, parentLocator)}) should have been registered`);

    const newVirtualInstances: Array<[Locator, Descriptor, Package]> = [];
    const parentPeerRequirements = new Map<IdentHash, PeerRequirementNode>();

    const firstPass = [];
    const secondPass = [];
    const thirdPass = [];
    const fourthPass = [];

    for (const descriptor of Array.from(parentPackage.dependencies.values())) {
      // We shouldn't virtualize the package if it was obtained through a peer
      // dependency (which can't be the case for workspaces when resolved
      // through their top-level)
      if (parentPackage.peerDependencies.has(descriptor.identHash) && parentPackage.locatorHash !== top)
        continue;

      // We had some issues where virtual packages were incorrectly set inside
      // workspaces, causing leaks. Check the Dragon Test #5 for more details.
      if (structUtils.isVirtualDescriptor(descriptor))
        throw new Error(`Assertion failed: Virtual packages shouldn't be encountered when virtualizing a branch`);

      // Mark this package as being used (won't be removed from the lockfile)
      volatileDescriptors.delete(descriptor.descriptorHash);

      // Detect whether this package is being required
      let isOptional = optional;
      if (!isOptional) {
        const dependencyMetaSet = parentPackage.dependenciesMeta.get(structUtils.stringifyIdent(descriptor));
        if (typeof dependencyMetaSet !== `undefined`) {
          const dependencyMeta = dependencyMetaSet.get(null);
          if (typeof dependencyMeta !== `undefined` && dependencyMeta.optional) {
            isOptional = true;
          }
        }
      }

      const resolution = allResolutions.get(descriptor.descriptorHash);
      if (!resolution)
        throw new Error(`Assertion failed: The resolution (${structUtils.prettyDescriptor(project.configuration, descriptor)}) should have been registered`);

      const pkg = originalWorkspaceDefinitions.get(resolution) || allPackages.get(resolution);
      if (!pkg)
        throw new Error(`Assertion failed: The package (${resolution}, resolved from ${structUtils.prettyDescriptor(project.configuration, descriptor)}) should have been registered`);

      if (pkg.peerDependencies.size === 0) {
        resolvePeerDependencies(descriptor, pkg, new Map(), {top, optional: isOptional});
        continue;
      }

      let virtualizedDescriptor: Descriptor;
      let virtualizedPackage: Package;

      const missingPeerDependencies = new Set<IdentHash>();
      const peerRequests = new Map<IdentHash, PeerRequestNode>();

      // In the first pass we virtualize the requester's descriptor and package
      firstPass.push(() => {
        virtualizedDescriptor = structUtils.virtualizeDescriptor(descriptor, parentLocator.locatorHash);
        virtualizedPackage = structUtils.virtualizePackage(pkg, parentLocator.locatorHash);

        parentPackage.dependencies.delete(descriptor.identHash);
        parentPackage.dependencies.set(virtualizedDescriptor.identHash, virtualizedDescriptor);

        allResolutions.set(virtualizedDescriptor.descriptorHash, virtualizedPackage.locatorHash);
        allDescriptors.set(virtualizedDescriptor.descriptorHash, virtualizedDescriptor);

        allPackages.set(virtualizedPackage.locatorHash, virtualizedPackage);

        // Keep track of all new virtual packages since we'll want to dedupe them
        newVirtualInstances.push([pkg, virtualizedDescriptor, virtualizedPackage]);
      });

      // In the second pass we resolve the peer requests to their provision.
      // This must be done in a separate pass since the provided package may
      // itself be a virtualized sibling package.
      secondPass.push(() => {
        allPeerRequests.set(virtualizedPackage.locatorHash, peerRequests);

        for (const peerDescriptor of virtualizedPackage.peerDependencies.values()) {
          const peerRequirement = miscUtils.getFactoryWithDefault(parentPeerRequirements, peerDescriptor.identHash, (): PeerRequirementNode => {
            let parentRequest = parentPeerRequests.get(peerDescriptor.identHash) ?? null;

            // 1. Try to resolve the peer request with parent's dependencies (siblings)
            let peerProvision = parentPackage.dependencies.get(peerDescriptor.identHash);

            // 2. Try to resolve the peer request with the parent itself
            if (!peerProvision && structUtils.areIdentsEqual(parentLocator, peerDescriptor)) {
              // If the parent isn't installed under an alias we can skip unnecessary steps
              if (parentDescriptor.identHash === parentLocator.identHash) {
                peerProvision = parentDescriptor;
              } else {
                peerProvision = structUtils.makeDescriptor(parentLocator, parentDescriptor.range);

                allDescriptors.set(peerProvision.descriptorHash, peerProvision);
                allResolutions.set(peerProvision.descriptorHash, parentLocator.locatorHash);

                volatileDescriptors.delete(peerProvision.descriptorHash);

                parentRequest = null;
              }
            }

            if (!peerProvision)
              peerProvision = structUtils.makeDescriptor(peerDescriptor, `missing:`);

            return {
              subject: parentLocator,
              ident: peerDescriptor,
              provided: peerProvision,
              root: !parentRequest,

              requests: new Map(),

              hash: `p${hashUtils.makeHash(parentLocator.locatorHash, peerDescriptor.identHash).slice(0, 5)}`,
            };
          });

          const peerProvision = peerRequirement.provided;
          // 3. Try package's own dependencies (peer-with-default)
          // This is done outside of the factory above because this resolution is not sharable between sibling virtuals
          if (peerProvision.range === `missing:` && virtualizedPackage.dependencies.has(peerDescriptor.identHash)) {
            virtualizedPackage.peerDependencies.delete(peerDescriptor.identHash);
            continue;
          }

          peerRequests.set(peerDescriptor.identHash, {
            requester: virtualizedPackage,
            descriptor: peerDescriptor,
            meta: virtualizedPackage.peerDependenciesMeta.get(structUtils.stringifyIdent(peerDescriptor)),

            children: new Map(),
          });

          virtualizedPackage.dependencies.set(peerDescriptor.identHash, peerProvision);

          // Need to track when a virtual descriptor is set as a dependency in case
          // the descriptor will be deduplicated.
          if (structUtils.isVirtualDescriptor(peerProvision)) {
            const dependents = miscUtils.getSetWithDefault(allVirtualDependents, peerProvision.descriptorHash);
            dependents.add(virtualizedPackage.locatorHash);
          }

          allIdents.set(peerProvision.identHash, peerProvision);
          if (peerProvision.range === `missing:`) {
            missingPeerDependencies.add(peerProvision.identHash);
          }
        }

        // Since we've had to add new dependencies we need to sort them all over again
        virtualizedPackage.dependencies = new Map(miscUtils.sortMap(virtualizedPackage.dependencies, ([identHash, descriptor]) => {
          return structUtils.stringifyIdent(descriptor);
        }));
      });

      // Between the second and third passes, the deduplication passes happen.

      // In the third pass, we recurse to resolve the peer request for the
      // virtual package, but only if it is not deduplicated. If the virtual
      // package is deduplicated, this would already have been done. This must
      // be done after the deduplication passes as otherwise it could lead to
      // infinite recursion when dealing with circular dependencies.
      thirdPass.push(() => {
        if (!allPackages.has(virtualizedPackage.locatorHash))
          return;

        // The stack overflow is checked against two level because a workspace
        // may have a dev dependency on another workspace that lists the first
        // one as a regular dependency. In this case the loop will break so we
        // don't need to throw an exception.
        const stackDepth = virtualStack.get(pkg.locatorHash);

        if (typeof stackDepth === `number` && stackDepth >= 2)
          reportStackOverflow();

        const current = virtualStack.get(pkg.locatorHash);
        const next = typeof current !== `undefined` ? current + 1 : 1;

        virtualStack.set(pkg.locatorHash, next);
        resolvePeerDependencies(virtualizedDescriptor, virtualizedPackage, peerRequests, {top, optional: isOptional});
        virtualStack.set(pkg.locatorHash, next - 1);
      });

      // In the fourth pass, we register information about the peer requirement
      // and peer request trees, using the post-deduplication information.
      fourthPass.push(() => {
        const finalDescriptor = parentPackage.dependencies.get(descriptor.identHash);
        if (typeof finalDescriptor === `undefined`)
          throw new Error(`Assertion failed: Expected the peer dependency to have been turned into a dependency`);

        const finalResolution = allResolutions.get(finalDescriptor.descriptorHash)!;
        if (typeof finalResolution === `undefined`)
          throw new Error(`Assertion failed: Expected the descriptor to be registered`);

        const finalPeerRequests = allPeerRequests.get(finalResolution);
        if (typeof finalPeerRequests === `undefined`)
          throw new Error(`Assertion failed: Expected the peer requests to be registered`);

        for (const peerRequirement of parentPeerRequirements.values()) {
          const peerRequest = finalPeerRequests.get(peerRequirement.ident.identHash);
          if (!peerRequest)
            continue;

          peerRequirement.requests.set(finalDescriptor.descriptorHash, peerRequest);
          peerRequirementNodes.set(peerRequirement.hash, peerRequirement);
          if (!peerRequirement.root) {
            parentPeerRequests.get(peerRequirement.ident.identHash)?.children.set(finalDescriptor.descriptorHash, peerRequest);
          }
        }

        if (!allPackages.has(virtualizedPackage.locatorHash))
          return;

        for (const missingPeerDependency of missingPeerDependencies) {
          virtualizedPackage.dependencies.delete(missingPeerDependency);
        }
      });
    }

    for (const fn of [...firstPass, ...secondPass])
      fn();

    let stable: boolean;
    do {
      stable = true;

      for (const [physicalLocator, virtualDescriptor, virtualPackage] of newVirtualInstances) {
        const otherVirtualInstances = miscUtils.getMapWithDefault(allVirtualInstances, physicalLocator.locatorHash);

        // We take all the dependencies from the new virtual instance and
        // generate a hash from it. By checking if this hash is already
        // registered, we know whether we can trim the new version.
        const dependencyHash = hashUtils.makeHash(
          ...[...virtualPackage.dependencies.values()].map(descriptor => {
            const resolution = descriptor.range !== `missing:`
              ? allResolutions.get(descriptor.descriptorHash)
              : `missing:`;

            if (typeof resolution === `undefined`)
              throw new Error(`Assertion failed: Expected the resolution for ${structUtils.prettyDescriptor(project.configuration, descriptor)} to have been registered`);

            return resolution === top ? `${resolution} (top)` : resolution;
          }),
          // We use the identHash to disambiguate between virtual descriptors
          // with different base idents being resolved to the same virtual package.
          // Note: We don't use the descriptorHash because the whole point of duplicate
          // virtual descriptors is that they have different `virtual:` ranges.
          // This causes the virtual descriptors with different base idents
          // to be preserved, while the virtual package they resolve to gets deduped.
          virtualDescriptor.identHash,
        );

        const masterDescriptor = otherVirtualInstances.get(dependencyHash);
        if (typeof masterDescriptor === `undefined`) {
          otherVirtualInstances.set(dependencyHash, virtualDescriptor);
          continue;
        }

        // Since we're applying multiple pass, we might have already registered
        // ourselves as the "master" descriptor in the previous pass.
        if (masterDescriptor === virtualDescriptor)
          continue;

        allPackages.delete(virtualPackage.locatorHash);
        allDescriptors.delete(virtualDescriptor.descriptorHash);
        allResolutions.delete(virtualDescriptor.descriptorHash);

        accessibleLocators.delete(virtualPackage.locatorHash);

        const dependents = allVirtualDependents.get(virtualDescriptor.descriptorHash) || [];
        const allDependents = [parentPackage.locatorHash, ...dependents];

        allVirtualDependents.delete(virtualDescriptor.descriptorHash);

        for (const dependent of allDependents) {
          const pkg = allPackages.get(dependent);
          if (typeof pkg === `undefined`)
            continue;

          if (pkg.dependencies.get(virtualDescriptor.identHash)!.descriptorHash !== masterDescriptor.descriptorHash)
            stable = false;

          pkg.dependencies.set(virtualDescriptor.identHash, masterDescriptor);
        }

        for (const peerRequirement of parentPeerRequirements.values()) {
          if (peerRequirement.provided.descriptorHash === virtualDescriptor.descriptorHash) {
            peerRequirement.provided = masterDescriptor;
          }
        }
      }
    } while (!stable);

    for (const fn of [...thirdPass, ...fourthPass]) {
      fn();
    }
  };

  for (const workspace of project.workspaces) {
    const locator = workspace.anchoredLocator;

    volatileDescriptors.delete(workspace.anchoredDescriptor.descriptorHash);
    resolvePeerDependencies(workspace.anchoredDescriptor, locator, new Map(), {top: locator.locatorHash, optional: false});
  }

  for (const requirement of peerRequirementNodes.values()) {
    // Only generate warnings on root requirements
    if (!requirement.root)
      continue;

    const dependent = allPackages.get(requirement.subject.locatorHash);

    // The package may have been pruned during a deduplication
    if (typeof dependent === `undefined`)
      continue;

    // For backwards-compatibility
    // TODO: Remove for next major
    for (const peerRequest of requirement.requests.values()) {
      const hash = `p${hashUtils.makeHash(requirement.subject.locatorHash, structUtils.stringifyIdent(requirement.ident), peerRequest.requester.locatorHash).slice(0, 5)}`;

      peerRequirements.set(hash, {
        subject: requirement.subject.locatorHash,
        requested: requirement.ident,
        rootRequester: peerRequest.requester.locatorHash,
        allRequesters: Array.from(structUtils.allPeerRequests(peerRequest), request => request.requester.locatorHash),
      });
    }

    const allRequests = [...structUtils.allPeerRequests(requirement)];

    if (requirement.provided.range !== `missing:`) {
      const peerPackage = getPackageFromDescriptor(requirement.provided);
      const peerVersion = peerPackage.version ?? `0.0.0`;

      const resolveWorkspaceRange = (range: string) => {
        if (range.startsWith(WorkspaceResolver.protocol)) {
          if (!project.tryWorkspaceByLocator(peerPackage))
            return null;

          range = range.slice(WorkspaceResolver.protocol.length);
          if (range === `^` || range === `~`) {
            range = `*`;
          }
        }

        return range;
      };

      let satisfiesAll = true;
      for (const peerRequest of allRequests) {
        const range = resolveWorkspaceRange(peerRequest.descriptor.range);
        if (range === null) {
          satisfiesAll = false;
          continue;
        }

        if (!semverUtils.satisfiesWithPrereleases(peerVersion, range)) {
          satisfiesAll = false;

          // For backwards-compatibility
          // TODO: Remove for next major
          const hash = `p${hashUtils.makeHash(requirement.subject.locatorHash, structUtils.stringifyIdent(requirement.ident), peerRequest.requester.locatorHash).slice(0, 5)}`;

          peerWarnings.push({
            type: PeerWarningType.NotCompatible,
            subject: dependent,
            requested: requirement.ident,
            requester: peerRequest.requester,
            version: peerVersion,
            hash,
            requirementCount: allRequests.length,
          });
        }
      }

      if (!satisfiesAll) {
        const allRanges = allRequests.map(peerRequest => resolveWorkspaceRange(peerRequest.descriptor.range));

        peerWarnings.push({
          type: PeerWarningType.NodeNotCompatible,
          node: requirement,
          range: allRanges.includes(null)
            ? null
            : semverUtils.simplifyRanges(allRanges as Array<string>),
          hash: requirement.hash,
        });
      }
    } else {
      let satisfiesAll = true;
      for (const peerRequest of allRequests) {
        if (!peerRequest.meta?.optional) {
          satisfiesAll = false;

          // For backwards-compatibility
          // TODO: Remove for next major
          const hash = `p${hashUtils.makeHash(requirement.subject.locatorHash, structUtils.stringifyIdent(requirement.ident), peerRequest.requester.locatorHash).slice(0, 5)}`;

          peerWarnings.push({
            type: PeerWarningType.NotProvided,
            subject: dependent,
            requested: requirement.ident,
            requester: peerRequest.requester,
            hash,
          });
        }
      }
      if (!satisfiesAll) {
        peerWarnings.push({
          type: PeerWarningType.NodeNotProvided,
          node: requirement,
          hash: requirement.hash,
        });
      }
    }
  }
}

function emitPeerDependencyWarnings(project: Project, report: Report) {
  const incompatibleWarnings: Array<string> = [];
  const missingWarnings: Array<string> = [];
  let hasTransitiveWarnings = false;

  for (const warning of project.peerWarnings) {
    if (warning.type === PeerWarningType.NotCompatible || warning.type === PeerWarningType.NotProvided)
      continue;

    if (!project.tryWorkspaceByLocator(warning.node.subject)) {
      hasTransitiveWarnings = true;
      continue;
    }

    if (warning.type === PeerWarningType.NodeNotCompatible) {
      const peerLocatorHash = project.storedResolutions.get(warning.node.provided.descriptorHash);
      if (typeof peerLocatorHash === `undefined`)
        throw new Error(`Assertion failed: Expected the descriptor to be registered`);

      const peerPackage = project.storedPackages.get(peerLocatorHash);
      if (typeof peerPackage === `undefined`)
        throw new Error(`Assertion failed: Expected the package to be registered`);

      const otherPackages = [...structUtils.allPeerRequests(warning.node)].length > 1
        ? `and other dependencies request`
        : `requests`;

      const rangeDescription = warning.range
        ? structUtils.prettyRange(project.configuration, warning.range)
        : formatUtils.pretty(project.configuration, `but they have non-overlapping ranges!`, `redBright`);

      incompatibleWarnings.push(`${
        structUtils.prettyIdent(project.configuration, warning.node.ident)
      } is listed by your project with version ${
        structUtils.prettyReference(project.configuration, peerPackage.version ?? `0.0.0`)
      } (${
        formatUtils.pretty(project.configuration, warning.hash, formatUtils.Type.CODE)
      }), which doesn't satisfy what ${
        structUtils.prettyIdent(project.configuration, warning.node.requests.values().next().value.requester)
      } ${otherPackages} (${rangeDescription}).`);
    }

    if (warning.type === PeerWarningType.NodeNotProvided) {
      const otherPackages = warning.node.requests.size > 1
        ? ` and other dependencies`
        : ``;

      missingWarnings.push(`${
        structUtils.prettyLocator(project.configuration, warning.node.subject)
      } doesn't provide ${
        structUtils.prettyIdent(project.configuration, warning.node.ident)
      } (${
        formatUtils.pretty(project.configuration, warning.hash, formatUtils.Type.CODE)
      }), requested by ${
        structUtils.prettyIdent(project.configuration, warning.node.requests.values().next().value.requester)
      }${otherPackages}.`);
    }
  }

  report.startSectionSync({
    reportFooter: () => {
      report.reportWarning(MessageName.EXPLAIN_PEER_DEPENDENCIES_CTA, `Some peer dependencies are incorrectly met by your project; run ${formatUtils.pretty(project.configuration, `yarn explain peer-requirements <hash>`, formatUtils.Type.CODE)} for details, where ${formatUtils.pretty(project.configuration, `<hash>`, formatUtils.Type.CODE)} is the six-letter p-prefixed code.`);
    },
    skipIfEmpty: true,
  }, () => {
    for (const warning of miscUtils.sortMap(incompatibleWarnings, line => formatUtils.stripAnsi(line)))
      report.reportWarning(MessageName.INCOMPATIBLE_PEER_DEPENDENCY, warning);

    for (const warning of miscUtils.sortMap(missingWarnings, line => formatUtils.stripAnsi(line))) {
      report.reportWarning(MessageName.MISSING_PEER_DEPENDENCY, warning);
    }
  });

  if (hasTransitiveWarnings) {
    report.reportWarning(MessageName.EXPLAIN_PEER_DEPENDENCIES_CTA, `Some peer dependencies are incorrectly met by dependencies; run ${formatUtils.pretty(project.configuration, `yarn explain peer-requirements`, formatUtils.Type.CODE)} for details.`);
  }
}
