import {PortablePath, ppath, xfs, normalizeLineEndings, Filename}       from '@yarnpkg/fslib';
import {npath}                                                          from '@yarnpkg/fslib';
import {parseSyml, stringifySyml}                                       from '@yarnpkg/parsers';
import {UsageError}                                                     from 'clipanion';
import {createHash}                                                     from 'crypto';
import {structuredPatch}                                                from 'diff';
import pick                                                             from 'lodash/pick';
import pLimit                                                           from 'p-limit';
import semver                                                           from 'semver';
import {promisify}                                                      from 'util';
import v8                                                               from 'v8';
import zlib                                                             from 'zlib';

import {Cache}                                                          from './Cache';
import {Configuration}                                                  from './Configuration';
import {Fetcher}                                                        from './Fetcher';
import {Installer, BuildDirective, BuildType}                           from './Installer';
import {LegacyMigrationResolver}                                        from './LegacyMigrationResolver';
import {Linker}                                                         from './Linker';
import {LockfileResolver}                                               from './LockfileResolver';
import {DependencyMeta, Manifest}                                       from './Manifest';
import {MessageName}                                                    from './MessageName';
import {MultiResolver}                                                  from './MultiResolver';
import {Report, ReportError}                                            from './Report';
import {ResolveOptions, Resolver}                                       from './Resolver';
import {RunInstallPleaseResolver}                                       from './RunInstallPleaseResolver';
import {ThrowReport}                                                    from './ThrowReport';
import {Workspace}                                                      from './Workspace';
import {isFolderInside}                                                 from './folderUtils';
import * as formatUtils                                                 from './formatUtils';
import * as hashUtils                                                   from './hashUtils';
import * as miscUtils                                                   from './miscUtils';
import * as scriptUtils                                                 from './scriptUtils';
import * as semverUtils                                                 from './semverUtils';
import * as structUtils                                                 from './structUtils';
import {IdentHash, DescriptorHash, LocatorHash, PackageExtensionStatus} from './types';
import {Descriptor, Ident, Locator, Package}                            from './types';
import {LinkType}                                                       from './types';

// When upgraded, the lockfile entries have to be resolved again (but the specific
// versions are still pinned, no worry). Bump it when you change the fields within
// the Package type; no more no less.
const LOCKFILE_VERSION = 4;

// Same thing but must be bumped when the members of the Project class changes (we
// don't recommend our users to check-in this file, so it's fine to bump it even
// between patch or minor releases).
const INSTALL_STATE_VERSION = 1;

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
  cache: Cache,

  /**
   * An optional override for the default fetching pipeline. This is for
   * overrides only - if you need to _add_ resolvers, prefer adding them
   * through regular plugins instead.
   */
  fetcher?: Fetcher,

  /**
   * An optional override for the default resolution pipeline. This is for
   * overrides only - if you need to _add_ resolvers, prefer adding them
   * through regular plugins instead.
   */
  resolver?: Resolver

  /**
   * Provide a report instance that'll be use to store the information emitted
   * during the install process.
   */
  report: Report,

  /**
   * If true, Yarn will check that the lockfile won't change after the
   * resolution step. Additionally, after the link step, Yarn will retrieve
   * the list of files in `immutablePatterns` and check that they didn't get
   * modified either.
   */
  immutable?: boolean,

  /**
   * If true, Yarn will exclusively use the lockfile metadata. Setting this
   * flag will cause it to ignore any change in the manifests, and to abort
   * if any dependency isn't present in the lockfile.
   */
  lockfileOnly?: boolean,

  /**
   * Changes which artifacts are generated during the install. Check the
   * enumeration documentation for details.
   */
  mode?: InstallMode,

  /**
   * If true (the default), Yarn will update the workspace manifests once the
   * install has completed.
   */
  persistProject?: boolean,

  /**
   * @deprecated Use `mode=skip-build`
   */
  skipBuild?: never,
};

const INSTALL_STATE_FIELDS = {
  restoreInstallersCustomData: [
    `installersCustomData`,
  ] as const,

  restoreResolutions: [
    `accessibleLocators`,
    `optionalBuilds`,
    `storedDescriptors`,
    `storedResolutions`,
    `storedPackages`,
    `lockFileChecksum`,
  ] as const,

  restoreBuildState: [
    `storedBuildState`,
  ] as const,
};

type RestoreInstallStateOpts = {
  [key in keyof typeof INSTALL_STATE_FIELDS]?: boolean;
};

// Just a type that's the union of all the fields declared in `INSTALL_STATE_FIELDS`
type InstallState = Pick<Project, typeof INSTALL_STATE_FIELDS[keyof typeof INSTALL_STATE_FIELDS][number]>;

export type PeerRequirement = {
  subject: LocatorHash,
  requested: Ident,
  rootRequester: LocatorHash,
  allRequesters: Array<LocatorHash>,
};

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
  public originalPackages: Map<LocatorHash, Package> = new Map();
  public optionalBuilds: Set<LocatorHash> = new Set();

  /**
   * Populated by the `resolveEverything` method.
   * *Not* stored inside the install state.
   *
   * The map keys are 6 hexadecimal characters except the first one, always `p`.
   */
  public peerRequirements: Map<string, PeerRequirement> = new Map();

  /**
   * Contains whatever data the installers (cf `Linker.ts`) want to persist
   * from an install to another.
   */
  public installersCustomData: Map<string, unknown> = new Map();

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

    throw new UsageError(`The nearest package directory (${formatUtils.pretty(configuration, packageCwd, formatUtils.Type.PATH)}) doesn't seem to be part of the project declared in ${formatUtils.pretty(configuration, project.cwd, formatUtils.Type.PATH)}.\n\n- If the project directory is right, it might be that you forgot to list ${formatUtils.pretty(configuration, ppath.relative(project.cwd, packageCwd), formatUtils.Type.PATH)} as a workspace.\n- If it isn't, it's likely because you have a yarn.lock or package.json file there, confusing the project root detection.`);
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

    const lockfilePath = ppath.join(this.cwd, this.configuration.get(`lockfileFilename`));
    const defaultLanguageName = this.configuration.get(`defaultLanguageName`);

    if (xfs.existsSync(lockfilePath)) {
      const content = await xfs.readFilePromise(lockfilePath, `utf8`);

      // We store the salted checksum of the lockfile in order to invalidate the install state when needed
      this.lockFileChecksum = hashUtils.makeHash(`${INSTALL_STATE_VERSION}`, content);

      const parsed: any = parseSyml(content);

      // Protects against v1 lockfiles
      if (parsed.__metadata) {
        const lockfileVersion = parsed.__metadata.version;
        const cacheKey = parsed.__metadata.cacheKey;

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

          if (lockfileVersion >= LOCKFILE_VERSION) {
            const pkg: Package = {...locator, version, languageName, linkType, dependencies, peerDependencies, dependenciesMeta, peerDependenciesMeta, bin};
            this.originalPackages.set(pkg.locatorHash, pkg);
          }

          for (const entry of key.split(MULTIPLE_KEYS_REGEXP)) {
            const descriptor = structUtils.parseDescriptor(entry);

            this.storedDescriptors.set(descriptor.descriptorHash, descriptor);

            if (lockfileVersion >= LOCKFILE_VERSION) {
              // If the lockfile is up-to-date, we can simply register the
              // resolution as a done deal.

              this.storedResolutions.set(descriptor.descriptorHash, locator.locatorHash);
            } else {
              // But if it isn't, then we instead setup an alias so that the
              // descriptor will be re-resolved (so that we get to retrieve the
              // new fields) while still resolving to the same locators.

              const resolutionDescriptor = structUtils.convertLocatorToDescriptor(locator);

              if (resolutionDescriptor.descriptorHash !== descriptor.descriptorHash) {
                this.storedDescriptors.set(resolutionDescriptor.descriptorHash, resolutionDescriptor);
                this.resolutionAliases.set(descriptor.descriptorHash, resolutionDescriptor.descriptorHash);
              }
            }
          }
        }
      }
    }
  }

  private async setupWorkspaces() {
    this.workspaces = [];

    this.workspacesByCwd = new Map();
    this.workspacesByIdent = new Map();

    let workspaceCwds = [this.cwd];
    while (workspaceCwds.length > 0) {
      const passCwds = workspaceCwds;
      workspaceCwds = [];

      for (const workspaceCwd of passCwds) {
        if (this.workspacesByCwd.has(workspaceCwd))
          continue;

        const workspace = await this.addWorkspace(workspaceCwd);

        const workspacePkg = this.storedPackages.get(workspace.anchoredLocator.locatorHash);
        if (workspacePkg)
          workspace.dependencies = workspacePkg.dependencies;

        for (const workspaceCwd of workspace.workspacesCwds) {
          workspaceCwds.push(workspaceCwd);
        }
      }
    }
  }

  private async addWorkspace(workspaceCwd: PortablePath) {
    const workspace = new Workspace(workspaceCwd, {project: this});
    await workspace.setup();

    const dup = this.workspacesByIdent.get(workspace.locator.identHash);
    if (typeof dup !== `undefined`)
      throw new Error(`Duplicate workspace name ${structUtils.prettyIdent(this.configuration, workspace.locator)}: ${npath.fromPortablePath(workspaceCwd)} conflicts with ${npath.fromPortablePath(dup.cwd)}`);

    this.workspaces.push(workspace);

    this.workspacesByCwd.set(workspaceCwd, workspace);
    this.workspacesByIdent.set(workspace.locator.identHash, workspace);

    return workspace;
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

    if (workspace.locator.locatorHash !== locator.locatorHash && workspace.anchoredLocator.locatorHash !== locator.locatorHash)
      return null;

    return workspace;
  }

  getWorkspaceByLocator(locator: Locator) {
    const workspace = this.tryWorkspaceByLocator(locator);

    if (!workspace)
      throw new Error(`Workspace not found (${structUtils.prettyLocator(this.configuration, locator)})`);

    return workspace;
  }

  /**
   * Import the dependencies of each resolved workspace into their own
   * `Workspace` instance.
   */
  private refreshWorkspaceDependencies() {
    for (const workspace of this.workspaces) {
      const pkg = this.storedPackages.get(workspace.anchoredLocator.locatorHash);
      if (!pkg)
        throw new Error(`Assertion failed: Expected workspace ${structUtils.prettyWorkspace(this.configuration, workspace)} (${formatUtils.pretty(this.configuration, ppath.join(workspace.cwd, Filename.manifest), formatUtils.Type.PATH)}) to have been resolved. Run "yarn install" to update the lockfile`);

      workspace.dependencies = new Map(pkg.dependencies);
    }
  }

  forgetResolution(descriptor: Descriptor): void;
  forgetResolution(locator: Locator): void;
  forgetResolution(dataStructure: Descriptor | Locator): void {
    const deleteDescriptor = (descriptorHash: DescriptorHash) => {
      this.storedResolutions.delete(descriptorHash);
      this.storedDescriptors.delete(descriptorHash);
    };

    const deleteLocator = (locatorHash: LocatorHash) => {
      this.originalPackages.delete(locatorHash);
      this.storedPackages.delete(locatorHash);
      this.accessibleLocators.delete(locatorHash);
    };

    if (`descriptorHash` in dataStructure) {
      const locatorHash = this.storedResolutions.get(dataStructure.descriptorHash);

      deleteDescriptor(dataStructure.descriptorHash);

      // We delete unused locators
      const remainingResolutions = new Set(this.storedResolutions.values());
      if (typeof locatorHash !== `undefined` && !remainingResolutions.has(locatorHash)) {
        deleteLocator(locatorHash);
      }
    }

    if (`locatorHash` in dataStructure) {
      deleteLocator(dataStructure.locatorHash);

      // We delete all of the descriptors that have been resolved to the locator
      for (const [descriptorHash, locatorHash] of this.storedResolutions) {
        if (locatorHash === dataStructure.locatorHash) {
          deleteDescriptor(descriptorHash);
        }
      }
    }
  }

  forgetTransientResolutions() {
    const resolver = this.configuration.makeResolver();

    for (const pkg of this.originalPackages.values()) {
      let shouldPersistResolution: boolean;
      try {
        shouldPersistResolution = resolver.shouldPersistResolution(pkg, {project: this, resolver});
      } catch {
        shouldPersistResolution = false;
      }

      if (!shouldPersistResolution) {
        this.forgetResolution(pkg);
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

  async resolveEverything(opts: Pick<InstallOptions, `report` | `resolver` | `mode`> & ({report: Report, lockfileOnly: true} | {lockfileOnly?: boolean, cache: Cache})) {
    if (!this.workspacesByCwd || !this.workspacesByIdent)
      throw new Error(`Workspaces must have been setup before calling this function`);

    // Reverts the changes that have been applied to the tree because of any previous virtual resolution pass
    this.forgetVirtualResolutions();

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

    const legacyMigrationResolver = new LegacyMigrationResolver();
    await legacyMigrationResolver.setup(this, {report: opts.report});

    const resolver: Resolver = opts.lockfileOnly
      ? new MultiResolver([new LockfileResolver(), new RunInstallPleaseResolver(realResolver)])
      : new MultiResolver([new LockfileResolver(), legacyMigrationResolver, realResolver]);

    const fetcher = this.configuration.makeFetcher();

    const resolveOptions: ResolveOptions = opts.lockfileOnly
      ? {project: this, report: opts.report, resolver}
      : {project: this, report: opts.report, resolver, fetchOptions: {project: this, cache: opts.cache, checksums: this.storedChecksums, report: opts.report, fetcher}};

    const allDescriptors = new Map<DescriptorHash, Descriptor>();
    const allPackages = new Map<LocatorHash, Package>();
    const allResolutions = new Map<DescriptorHash, LocatorHash>();

    const originalPackages = new Map<LocatorHash, Package>();

    const packageResolutionPromises = new Map<LocatorHash, Promise<Package>>();
    const descriptorResolutionPromises = new Map<DescriptorHash, Promise<Package>>();

    const resolutionQueue: Array<Promise<unknown>> = [];

    const startPackageResolution = async (locator: Locator) => {
      const originalPkg = await miscUtils.prettifyAsyncErrors(async () => {
        return await resolver.resolve(locator, resolveOptions);
      }, message => {
        return `${structUtils.prettyLocator(this.configuration, locator)}: ${message}`;
      });

      if (!structUtils.areLocatorsEqual(locator, originalPkg))
        throw new Error(`Assertion failed: The locator cannot be changed by the resolver (went from ${structUtils.prettyLocator(this.configuration, locator)} to ${structUtils.prettyLocator(this.configuration, originalPkg)})`);

      originalPackages.set(originalPkg.locatorHash, originalPkg);

      const pkg = this.configuration.normalizePackage(originalPkg);

      for (const [identHash, descriptor] of pkg.dependencies) {
        const dependency = await this.configuration.reduceHook(hooks => {
          return hooks.reduceDependency;
        }, descriptor, this, pkg, descriptor, {
          resolver,
          resolveOptions,
        });

        if (!structUtils.areIdentsEqual(descriptor, dependency))
          throw new Error(`Assertion failed: The descriptor ident cannot be changed through aliases`);

        const bound = resolver.bindDescriptor(dependency, locator, resolveOptions);
        pkg.dependencies.set(identHash, bound);
      }

      resolutionQueue.push(Promise.all([...pkg.dependencies.values()].map(descriptor => {
        return scheduleDescriptorResolution(descriptor);
      })));

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
      const alias = this.resolutionAliases.get(descriptor.descriptorHash);
      if (typeof alias !== `undefined`)
        return startDescriptorAliasing(descriptor, this.storedDescriptors.get(alias)!);

      const resolutionDependencies = resolver.getResolutionDependencies(descriptor, resolveOptions);
      const resolvedDependencies = new Map(await Promise.all(resolutionDependencies.map(async dependency => {
        return [dependency.descriptorHash, await scheduleDescriptorResolution(dependency)] as const;
      })));

      const candidateResolutions = await miscUtils.prettifyAsyncErrors(async () => {
        return await resolver.getCandidates(descriptor, resolvedDependencies, resolveOptions);
      }, message => {
        return `${structUtils.prettyDescriptor(this.configuration, descriptor)}: ${message}`;
      });

      const finalResolution = candidateResolutions[0];
      if (typeof finalResolution === `undefined`)
        throw new Error(`${structUtils.prettyDescriptor(this.configuration, descriptor)}: No candidates found`);

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
      await Promise.all(copy);
    }

    // In this step we now create virtual packages for each package with at
    // least one peer dependency. We also use it to search for the alias
    // descriptors that aren't depended upon by anything and can be safely
    // pruned.

    const volatileDescriptors = new Set(this.resolutionAliases.values());
    const optionalBuilds = new Set(allPackages.keys());
    const accessibleLocators = new Set<LocatorHash>();
    const peerRequirements: Project['peerRequirements'] = new Map();

    applyVirtualResolutionMutations({
      project: this,
      report: opts.report,

      accessibleLocators,
      volatileDescriptors,
      optionalBuilds,
      peerRequirements,

      allDescriptors,
      allResolutions,
      allPackages,
    });

    // All descriptors still referenced within the volatileDescriptors set are
    // descriptors that aren't depended upon by anything in the dependency tree.

    for (const descriptorHash of volatileDescriptors) {
      allDescriptors.delete(descriptorHash);
      allResolutions.delete(descriptorHash);
    }

    // Everything is done, we can now update our internal resolutions to
    // reference the new ones

    this.storedResolutions = allResolutions;
    this.storedDescriptors = allDescriptors;
    this.storedPackages = allPackages;

    this.accessibleLocators = accessibleLocators;
    this.originalPackages = originalPackages;
    this.optionalBuilds = optionalBuilds;
    this.peerRequirements = peerRequirements;

    // Now that the internal resolutions have been updated, we can refresh the
    // dependencies of each resolved workspace's `Workspace` instance.

    this.refreshWorkspaceDependencies();
  }

  async fetchEverything({cache, report, fetcher: userFetcher, mode}: InstallOptions) {
    const fetcher = userFetcher || this.configuration.makeFetcher();
    const fetcherOptions = {checksums: this.storedChecksums, project: this, cache, fetcher, report};

    let locatorHashes = Array.from(
      new Set(
        miscUtils.sortMap(this.storedResolutions.values(), [
          (locatorHash: LocatorHash) => {
            const pkg = this.storedPackages.get(locatorHash);
            if (!pkg)
              throw new Error(`Assertion failed: The locator should have been registered`);

            return structUtils.stringifyLocator(pkg);
          },
        ])
      )
    );

    // In "dependency update" mode, we won't trigger the link step. As a
    // result, we only need to fetch the packages that are missing their
    // hashes (to add them to the lockfile).
    if (mode === InstallMode.UpdateLockfile)
      locatorHashes = locatorHashes.filter(locatorHash => !this.storedChecksums.has(locatorHash));

    let firstError = false;

    const progress = Report.progressViaCounter(locatorHashes.length);
    report.reportProgress(progress);

    const limit = pLimit(FETCHER_CONCURRENCY);

    await report.startCacheReport(async () => {
      await Promise.all(locatorHashes.map(locatorHash => limit(async () => {
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

        if (fetchResult.checksum)
          this.storedChecksums.set(pkg.locatorHash, fetchResult.checksum);
        else
          this.storedChecksums.delete(pkg.locatorHash);

        if (fetchResult.releaseFs) {
          fetchResult.releaseFs();
        }
      }).finally(() => {
        progress.tick();
      })));
    });

    if (firstError) {
      throw firstError;
    }
  }

  async linkEverything({cache, report, fetcher: optFetcher, mode}: InstallOptions) {
    const fetcher = optFetcher || this.configuration.makeFetcher();
    const fetcherOptions = {checksums: this.storedChecksums, project: this, cache, fetcher, report, skipIntegrityCheck: true};

    const linkers = this.configuration.getLinkers();
    const linkerOptions = {project: this, report};

    const installers = new Map(linkers.map(linker => {
      const installer = linker.makeInstaller(linkerOptions);

      const customDataKey = installer.getCustomDataKey();
      const customData = this.installersCustomData.get(customDataKey);
      if (typeof customData !== `undefined`)
        installer.attachCustomData(customData);

      return [linker, installer] as [Linker, Installer];
    }));

    const packageLinkers: Map<LocatorHash, Linker> = new Map();
    const packageLocations: Map<LocatorHash, PortablePath | null> = new Map();
    const packageBuildDirectives: Map<LocatorHash, { directives: Array<BuildDirective>, buildLocations: Array<PortablePath> }> = new Map();

    const fetchResultsPerPackage = new Map(await Promise.all([...this.accessibleLocators].map(async locatorHash => {
      const pkg = this.storedPackages.get(locatorHash);
      if (!pkg)
        throw new Error(`Assertion failed: The locator should have been registered`);

      return [locatorHash, await fetcher.fetch(pkg, fetcherOptions)] as const;
    })));

    // Step 1: Installing the packages on the disk

    for (const locatorHash of this.accessibleLocators) {
      const pkg = this.storedPackages.get(locatorHash);
      if (typeof pkg === `undefined`)
        throw new Error(`Assertion failed: The locator should have been registered`);

      const fetchResult = fetchResultsPerPackage.get(pkg.locatorHash);
      if (typeof fetchResult === `undefined`)
        throw new Error(`Assertion failed: The fetch result should have been registered`);

      const workspace = this.tryWorkspaceByLocator(pkg);

      if (workspace !== null) {
        const buildScripts: Array<BuildDirective> = [];
        const {scripts} = workspace.manifest;

        for (const scriptName of [`preinstall`, `install`, `postinstall`])
          if (scripts.has(scriptName))
            buildScripts.push([BuildType.SCRIPT, scriptName]);

        try {
          for (const [linker, installer] of installers) {
            if (linker.supportsPackage(pkg, linkerOptions)) {
              const result = await installer.installPackage(pkg, fetchResult);
              if (result.buildDirective !== null) {
                throw new Error(`Assertion failed: Linkers can't return build directives for workspaces; this responsibility befalls to the Yarn core`);
              }
            }
          }
        } finally {
          if (fetchResult.releaseFs) {
            fetchResult.releaseFs();
          }
        }

        const location = ppath.join(fetchResult.packageFs.getRealPath(), fetchResult.prefixPath);
        packageLocations.set(pkg.locatorHash, location);

        // Virtual workspaces shouldn't be built as they don't really exist
        if (!structUtils.isVirtualLocator(pkg) && buildScripts.length > 0) {
          packageBuildDirectives.set(pkg.locatorHash, {
            directives: buildScripts,
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

        let installStatus;
        try {
          installStatus = await installer.installPackage(pkg, fetchResult);
        } finally {
          if (fetchResult.releaseFs) {
            fetchResult.releaseFs();
          }
        }

        packageLinkers.set(pkg.locatorHash, linker);
        packageLocations.set(pkg.locatorHash, installStatus.packageLocation);

        if (installStatus.buildDirective && installStatus.packageLocation) {
          packageBuildDirectives.set(pkg.locatorHash, {
            directives: installStatus.buildDirective,
            buildLocations: [installStatus.packageLocation],
          });
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

          if (dependencyLinker === packageLinker || isWorkspace || isWorkspaceDependency) {
            if (packageLocations.get(dependency.locatorHash) !== null) {
              internalDependencies.push([descriptor, dependency] as [Descriptor, Locator]);
            }
          } else if (packageLocation !== null) {
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

    const installersCustomData = new Map();

    for (const installer of installers.values()) {
      const finalizeInstallData = await installer.finalizeInstall();

      for (const installStatus of finalizeInstallData?.records ?? []) {
        packageBuildDirectives.set(installStatus.locatorHash, {
          directives: installStatus.buildDirective,
          buildLocations: installStatus.buildLocations,
        });
      }

      if (typeof finalizeInstallData?.customData !== `undefined`) {
        installersCustomData.set(installer.getCustomDataKey(), finalizeInstallData.customData);
      }
    }

    this.installersCustomData = installersCustomData;

    // Step 4: Build the packages in multiple steps

    if (mode === InstallMode.SkipBuild)
      return;

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

    while (buildablePackages.size > 0) {
      const savedSize = buildablePackages.size;
      const buildPromises = [];

      for (const locatorHash of buildablePackages) {
        const pkg = this.storedPackages.get(locatorHash);
        if (!pkg)
          throw new Error(`Assertion failed: The package should have been registered`);

        let isBuildable = true;
        for (const dependency of pkg.dependencies.values()) {
          const resolution = this.storedResolutions.get(dependency.descriptorHash);
          if (!resolution)
            throw new Error(`Assertion failed: The resolution (${structUtils.prettyDescriptor(this.configuration, dependency)}) should have been registered`);

          if (buildablePackages.has(resolution)) {
            isBuildable = false;
            break;
          }
        }

        // Wait until all dependencies of the current package have been built
        // before trying to build it (since it might need them to build itself)
        if (!isBuildable)
          continue;

        buildablePackages.delete(locatorHash);

        const buildInfo = packageBuildDirectives.get(pkg.locatorHash);
        if (!buildInfo)
          throw new Error(`Assertion failed: The build directive should have been registered`);

        const buildHash = getBuildHash(pkg, buildInfo.buildLocations);

        // No need to rebuild the package if its hash didn't change
        if (this.storedBuildState.get(pkg.locatorHash) === buildHash) {
          nextBState.set(pkg.locatorHash, buildHash);
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

        for (const location of buildInfo.buildLocations) {
          if (!ppath.isAbsolute(location))
            throw new Error(`Assertion failed: Expected the build location to be absolute (not ${location})`);

          buildPromises.push((async () => {
            for (const [buildType, scriptName] of buildInfo.directives) {
              let header = `# This file contains the result of Yarn building a package (${structUtils.stringifyLocator(pkg)})\n`;
              switch (buildType) {
                case BuildType.SCRIPT: {
                  header += `# Script name: ${scriptName}\n`;
                } break;
                case BuildType.SHELLCODE: {
                  header += `# Script code: ${scriptName}\n`;
                } break;
              }

              const stdin = null;

              const wasBuildSuccessful = await xfs.mktempPromise(async logDir => {
                const logFile = ppath.join(logDir, `build.log` as PortablePath);

                const {stdout, stderr} = this.configuration.getSubprocessStreams(logFile, {
                  header,
                  prefix: structUtils.prettyLocator(this.configuration, pkg),
                  report,
                });

                let exitCode;
                try {
                  switch (buildType) {
                    case BuildType.SCRIPT: {
                      exitCode = await scriptUtils.executePackageScript(pkg, scriptName, [], {cwd: location, project: this, stdin, stdout, stderr});
                    } break;
                    case BuildType.SHELLCODE: {
                      exitCode = await scriptUtils.executePackageShellcode(pkg, scriptName, [], {cwd: location, project: this, stdin, stdout, stderr});
                    } break;
                  }
                } catch (error) {
                  stderr.write(error.stack);
                  exitCode = 1;
                }

                stdout.end();
                stderr.end();

                if (exitCode === 0) {
                  nextBState.set(pkg.locatorHash, buildHash);
                  return true;
                }

                xfs.detachTemp(logDir);

                const buildMessage = `${structUtils.prettyLocator(this.configuration, pkg)} couldn't be built successfully (exit code ${formatUtils.pretty(this.configuration, exitCode, formatUtils.Type.NUMBER)}, logs can be found here: ${formatUtils.pretty(this.configuration, logFile, formatUtils.Type.PATH)})`;

                if (this.optionalBuilds.has(pkg.locatorHash)) {
                  report.reportInfo(MessageName.BUILD_FAILED, buildMessage);
                  nextBState.set(pkg.locatorHash, buildHash);
                  return true;
                } else {
                  report.reportError(MessageName.BUILD_FAILED, buildMessage);
                  return false;
                }
              });

              if (!wasBuildSuccessful) {
                return;
              }
            }
          })());
        }
      }

      await Promise.all(buildPromises);

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
  }

  async install(opts: InstallOptions) {
    const nodeLinker = this.configuration.get(`nodeLinker`);
    Configuration.telemetry?.reportInstall(nodeLinker);

    await opts.report.startTimerPromise(`Project validation`, {
      skipIfEmpty: true,
    }, async () => {
      await this.configuration.triggerHook(hooks => {
        return hooks.validateProject;
      }, this, {
        reportWarning: opts.report.reportWarning.bind(opts.report),
        reportError: opts.report.reportError.bind(opts.report),
      });
    });

    for (const extensionsByIdent of this.configuration.packageExtensions.values())
      for (const [, extensionsByRange] of extensionsByIdent)
        for (const extension of extensionsByRange)
          extension.status = PackageExtensionStatus.Inactive;

    const lockfilePath = ppath.join(this.cwd, this.configuration.get(`lockfileFilename`));

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
      for (const [, extensionsPerRange] of this.configuration.packageExtensions) {
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
          const diff = structuredPatch(lockfilePath, lockfilePath, initialLockfile, newLockfile);

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

          throw new ReportError(MessageName.FROZEN_LOCKFILE_EXCEPTION, `The lockfile would have been modified by this install, which is explicitly forbidden.`);
        }
      }
    });

    for (const extensionsByIdent of this.configuration.packageExtensions.values())
      for (const [, extensionsByRange] of extensionsByIdent)
        for (const extension of extensionsByRange)
          if (extension.userProvided && extension.status === PackageExtensionStatus.Active)
            Configuration.telemetry?.reportPackageExtension(formatUtils.json(extension, formatUtils.Type.PACKAGE_EXTENSION));

    await opts.report.startTimerPromise(`Fetch step`, async () => {
      await this.fetchEverything(opts);

      if ((typeof opts.persistProject === `undefined` || opts.persistProject) && opts.mode !== InstallMode.UpdateLockfile) {
        await this.cacheCleanup(opts);
      }
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

    optimizedLockfile.__metadata = {
      version: LOCKFILE_VERSION,
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

      let entryChecksum: string | undefined;
      const checksum = this.storedChecksums.get(pkg.locatorHash);
      if (typeof checksum !== `undefined`) {
        const cacheKeyIndex = checksum.indexOf(`/`);
        if (cacheKeyIndex === -1)
          throw new Error(`Assertion failed: Expecte the checksum to reference its cache key`);

        const cacheKey = checksum.slice(0, cacheKeyIndex);
        const hash = checksum.slice(cacheKeyIndex + 1);

        if (typeof optimizedLockfile.__metadata.cacheKey === `undefined`)
          optimizedLockfile.__metadata.cacheKey = cacheKey;

        if (cacheKey === optimizedLockfile.__metadata.cacheKey) {
          entryChecksum = hash;
        } else {
          entryChecksum = checksum;
        }
      }

      optimizedLockfile[key] = {
        ...manifest.exportTo({}, {
          compatibilityMode: false,
        }),

        linkType: pkg.linkType.toLowerCase(),

        resolution: structUtils.stringifyLocator(pkg),
        checksum: entryChecksum,
      };
    }

    const header = `${[
      `# This file is generated by running "yarn install" inside your project.\n`,
      `# Manual changes might be lost - proceed with caution!\n`,
    ].join(``)}\n`;

    return header + stringifySyml(optimizedLockfile);
  }

  async persistLockfile() {
    const lockfilePath = ppath.join(this.cwd, this.configuration.get(`lockfileFilename`));
    const lockfileContent = this.generateLockfile();

    await xfs.changeFilePromise(lockfilePath, lockfileContent, {
      automaticNewlines: true,
    });
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

  async restoreInstallState({restoreInstallersCustomData = true, restoreResolutions = true, restoreBuildState = true}: RestoreInstallStateOpts = {}) {
    const installStatePath = this.configuration.get(`installStatePath`);
    if (!xfs.existsSync(installStatePath)) {
      if (restoreResolutions)
        await this.applyLightResolution();
      return;
    }

    const installStateBuffer = await gunzip(await xfs.readFilePromise(installStatePath)) as Buffer;
    this.installStateChecksum = hashUtils.makeHash(installStateBuffer);
    const installState: InstallState = v8.deserialize(installStateBuffer);

    if (restoreInstallersCustomData)
      if (typeof installState.installersCustomData !== `undefined`)
        this.installersCustomData = installState.installersCustomData;

    if (restoreBuildState)
      Object.assign(this, pick(installState, INSTALL_STATE_FIELDS.restoreBuildState));

    // Resolutions needs to be restored last otherwise applyLightResolution will persist a new state
    // before the rest is restored
    if (restoreResolutions) {
      if (installState.lockFileChecksum === this.lockFileChecksum) {
        Object.assign(this, pick(installState, INSTALL_STATE_FIELDS.restoreResolutions));
        this.refreshWorkspaceDependencies();
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
    await this.persistLockfile();

    for (const workspace of this.workspacesByCwd.values()) {
      await workspace.persistManifest();
    }
  }

  async cacheCleanup({cache, report}: InstallOptions)  {
    const PRESERVED_FILES = new Set([
      `.gitignore`,
    ]);

    if (!isFolderInside(cache.cwd, this.cwd))
      return;

    if (!(await xfs.existsPromise(cache.cwd)))
      return;

    const preferAggregateCacheInfo = this.configuration.get(`preferAggregateCacheInfo`);

    let entriesRemoved = 0;
    let lastEntryRemoved = null;

    for (const entry of await xfs.readdirPromise(cache.cwd)) {
      if (PRESERVED_FILES.has(entry))
        continue;

      const entryPath = ppath.resolve(cache.cwd, entry);
      if (cache.markedFiles.has(entryPath))
        continue;

      lastEntryRemoved = entry;

      if (cache.immutable) {
        report.reportError(MessageName.IMMUTABLE_CACHE, `${formatUtils.pretty(this.configuration, ppath.basename(entryPath), `magenta`)} appears to be unused and would be marked for deletion, but the cache is immutable`);
      } else {
        if (preferAggregateCacheInfo)
          entriesRemoved += 1;
        else
          report.reportInfo(MessageName.UNUSED_CACHE_ENTRY, `${formatUtils.pretty(this.configuration, ppath.basename(entryPath), `magenta`)} appears to be unused - removing`);

        await xfs.removePromise(entryPath);
      }
    }

    if (preferAggregateCacheInfo && entriesRemoved !== 0) {
      report.reportInfo(
        MessageName.UNUSED_CACHE_ENTRY,
        entriesRemoved > 1
          ? `${entriesRemoved} packages appeared to be unused and were removed`
          : `${lastEntryRemoved} appeared to be unused and was removed`
      );
    }

    cache.markedFiles.clear();
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
  volatileDescriptors = new Set(),
  peerRequirements = new Map(),

  report,

  tolerateMissingPackages = false,
}: {
  project: Project,

  allDescriptors: Map<DescriptorHash, Descriptor>,
  allResolutions: Map<DescriptorHash, LocatorHash>,
  allPackages: Map<LocatorHash, Package>,

  accessibleLocators?: Set<LocatorHash>,
  optionalBuilds?: Set<LocatorHash>,
  volatileDescriptors?: Set<DescriptorHash>,
  peerRequirements?: Project['peerRequirements'],

  report: Report | null,

  tolerateMissingPackages?: boolean,
}) {
  const virtualStack = new Map<LocatorHash, number>();
  const resolutionStack: Array<Locator> = [];

  const allIdents = new Map<IdentHash, Ident>();

  // We'll be keeping track of all virtual descriptors; once they have all
  // been generated we'll check whether they can be consolidated into one.
  const allVirtualInstances = new Map<LocatorHash, Map<string, Descriptor>>();
  const allVirtualDependents = new Map<DescriptorHash, Set<LocatorHash>>();

  // First key is the first package that requests the peer dependency. Second
  // key is the name of the package in the peer dependency. Value is the list
  // of all packages that extend the original peer requirement.
  const peerDependencyLinks: Map<LocatorHash, Map<string, Array<LocatorHash>>> = new Map();

  // We keep track on which package depend on which other package with peer
  // dependencies; this way we can emit warnings for them later on.
  const peerDependencyDependents = new Map<LocatorHash, Set<LocatorHash>>();

  // We must keep a copy of the workspaces original dependencies, because they
  // may be overriden during the virtual package resolution - cf Dragon Test #5
  const originalWorkspaceDefinitions = new Map<LocatorHash, Package | null>(project.workspaces.map(workspace => {
    const locatorHash = workspace.anchoredLocator.locatorHash;
    const pkg = allPackages.get(locatorHash);

    if (typeof pkg === `undefined`) {
      if (tolerateMissingPackages) {
        return [locatorHash, null];
      } else {
        throw new Error(`Assertion failed: The workspace should have an associated package`);
      }
    }

    return [locatorHash, structUtils.copyPackage(pkg)];
  }));

  const reportStackOverflow = (): never => {
    const logDir = xfs.mktempSync();
    const logFile = ppath.join(logDir, `stacktrace.log` as Filename);

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

  const resolvePeerDependencies = (parentLocator: Locator, peerSlots: Map<IdentHash, LocatorHash>, {top, optional}: {top: LocatorHash, optional: boolean}) => {
    if (resolutionStack.length > 1000)
      reportStackOverflow();

    resolutionStack.push(parentLocator);
    const result = resolvePeerDependenciesImpl(parentLocator, peerSlots, {top, optional});
    resolutionStack.pop();

    return result;
  };

  const resolvePeerDependenciesImpl = (parentLocator: Locator, peerSlots: Map<IdentHash, LocatorHash>, {top, optional}: {top: LocatorHash, optional: boolean}) => {
    if (accessibleLocators.has(parentLocator.locatorHash))
      return;

    accessibleLocators.add(parentLocator.locatorHash);

    if (!optional)
      optionalBuilds.delete(parentLocator.locatorHash);

    const parentPackage = allPackages.get(parentLocator.locatorHash);
    if (!parentPackage) {
      if (tolerateMissingPackages) {
        return;
      } else {
        throw new Error(`Assertion failed: The package (${structUtils.prettyLocator(project.configuration, parentLocator)}) should have been registered`);
      }
    }

    const newVirtualInstances: Array<[Locator, Descriptor, Package]> = [];

    const firstPass = [];
    const secondPass = [];
    const thirdPass = [];
    const fourthPass = [];

    // During this first pass we virtualize the descriptors. This allows us
    // to reference them from their sibling without being order-dependent,
    // which is required to solve cases where packages with peer dependencies
    // have peer dependencies themselves.

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
      if (!resolution) {
        // Note that we can't use `getPackageFromDescriptor` (defined below,
        // because when doing the initial tree building right after loading the
        // project it's possible that we get some entries that haven't been
        // registered into the lockfile yet - for example when the user has
        // manually changed the package.json dependencies)
        if (tolerateMissingPackages) {
          continue;
        } else {
          throw new Error(`Assertion failed: The resolution (${structUtils.prettyDescriptor(project.configuration, descriptor)}) should have been registered`);
        }
      }

      const pkg = originalWorkspaceDefinitions.get(resolution) || allPackages.get(resolution);
      if (!pkg)
        throw new Error(`Assertion failed: The package (${resolution}, resolved from ${structUtils.prettyDescriptor(project.configuration, descriptor)}) should have been registered`);

      if (pkg.peerDependencies.size === 0) {
        resolvePeerDependencies(pkg, new Map(), {top, optional: isOptional});
        continue;
      }

      // The stack overflow is checked against two level because a workspace
      // may have a dev dependency on another workspace that lists the first
      // one as a regular dependency. In this case the loop will break so we
      // don't need to throw an exception.
      const stackDepth = virtualStack.get(pkg.locatorHash);
      if (typeof stackDepth === `number` && stackDepth >= 2)
        reportStackOverflow();

      let virtualizedDescriptor: Descriptor;
      let virtualizedPackage: Package;

      const missingPeerDependencies = new Set<IdentHash>();

      let nextPeerSlots: Map<IdentHash, LocatorHash>;

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

      secondPass.push(() => {
        nextPeerSlots = new Map<IdentHash, LocatorHash>();

        for (const peerRequest of virtualizedPackage.peerDependencies.values()) {
          let peerDescriptor = parentPackage.dependencies.get(peerRequest.identHash);

          if (!peerDescriptor && structUtils.areIdentsEqual(parentLocator, peerRequest)) {
            peerDescriptor = structUtils.convertLocatorToDescriptor(parentLocator);

            allDescriptors.set(peerDescriptor.descriptorHash, peerDescriptor);
            allResolutions.set(peerDescriptor.descriptorHash, parentLocator.locatorHash);

            volatileDescriptors.delete(peerDescriptor.descriptorHash);
          }

          // If the peerRequest isn't provided by the parent then fall back to dependencies
          if ((!peerDescriptor || peerDescriptor.range === `missing:`) && virtualizedPackage.dependencies.has(peerRequest.identHash)) {
            virtualizedPackage.peerDependencies.delete(peerRequest.identHash);
            continue;
          }

          if (!peerDescriptor)
            peerDescriptor = structUtils.makeDescriptor(peerRequest, `missing:`);

          virtualizedPackage.dependencies.set(peerDescriptor.identHash, peerDescriptor);

          // Need to track when a virtual descriptor is set as a dependency in case
          // the descriptor will be consolidated.
          if (structUtils.isVirtualDescriptor(peerDescriptor)) {
            const dependents = miscUtils.getSetWithDefault(allVirtualDependents, peerDescriptor.descriptorHash);
            dependents.add(virtualizedPackage.locatorHash);
          }

          allIdents.set(peerDescriptor.identHash, peerDescriptor);
          if (peerDescriptor.range === `missing:`)
            missingPeerDependencies.add(peerDescriptor.identHash);

          nextPeerSlots.set(peerRequest.identHash, peerSlots.get(peerRequest.identHash) ?? virtualizedPackage.locatorHash);
        }

        // Since we've had to add new dependencies we need to sort them all over again
        virtualizedPackage.dependencies = new Map(miscUtils.sortMap(virtualizedPackage.dependencies, ([identHash, descriptor]) => {
          return structUtils.stringifyIdent(descriptor);
        }));
      });

      thirdPass.push(() => {
        if (!allPackages.has(virtualizedPackage.locatorHash))
          return;

        const current = virtualStack.get(pkg.locatorHash);
        const next = typeof current !== `undefined` ? current + 1 : 1;

        virtualStack.set(pkg.locatorHash, next);
        resolvePeerDependencies(virtualizedPackage, nextPeerSlots, {top, optional: isOptional});
        virtualStack.set(pkg.locatorHash, next - 1);
      });

      fourthPass.push(() => {
        // Regardless of whether the initial virtualized package got deduped
        // or not, we now register that *this* package is now a dependent on
        // whatever its peer dependencies have been resolved to. We'll later
        // use this information to generate warnings.
        const finalDescriptor = parentPackage.dependencies.get(descriptor.identHash);
        if (typeof finalDescriptor === `undefined`)
          throw new Error(`Assertion failed: Expected the peer dependency to have been turned into a dependency`);

        const finalResolution = allResolutions.get(finalDescriptor.descriptorHash)!;
        if (typeof finalResolution === `undefined`)
          throw new Error(`Assertion failed: Expected the descriptor to be registered`);

        miscUtils.getSetWithDefault(peerDependencyDependents, finalResolution).add(parentLocator.locatorHash);

        if (!allPackages.has(virtualizedPackage.locatorHash))
          return;

        for (const descriptor of virtualizedPackage.peerDependencies.values()) {
          const root = nextPeerSlots.get(descriptor.identHash);
          if (typeof root === `undefined`)
            throw new Error(`Assertion failed: Expected the peer dependency ident to be registered`);

          miscUtils.getArrayWithDefault(miscUtils.getMapWithDefault(peerDependencyLinks, root), structUtils.stringifyIdent(descriptor)).push(virtualizedPackage.locatorHash);
        }

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
        if (!allPackages.has(virtualPackage.locatorHash))
          continue;

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

        stable = false;

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

          pkg.dependencies.set(virtualDescriptor.identHash, masterDescriptor);
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
    resolvePeerDependencies(locator, new Map(), {top: locator.locatorHash, optional: false});
  }

  enum WarningType {
    NotProvided,
    NotCompatible,
  }

  type Warning = {
    type: WarningType.NotProvided,
    subject: Locator,
    requested: Ident,
    requester: Ident,
    hash: string,
  } | {
    type: WarningType.NotCompatible,
    subject: Locator,
    requested: Ident,
    requester: Ident,
    version: string,
    hash: string,
    requirementCount: number,
  };

  const warnings: Array<Warning> = [];

  for (const [rootHash, dependents] of peerDependencyDependents) {
    const root = allPackages.get(rootHash);
    if (typeof root === `undefined`)
      throw new Error(`Assertion failed: Expected the root to be registered`);

    // We retrieve the set of packages that provide complementary peer
    // dependencies to the one already offered by our root package, and to
    // whom other package.
    //
    // We simply skip if the record doesn't exist because a package may not
    // have any records if it didn't contribute any new peer (it only exists
    // if the package has at least one peer that isn't listed by its parent
    // packages).
    //
    const rootLinks = peerDependencyLinks.get(rootHash);
    if (typeof rootLinks === `undefined`)
      continue;

    for (const dependentHash of dependents) {
      const dependent = allPackages.get(dependentHash);

      // The package may have been pruned during a deduplication
      if (typeof dependent === `undefined`)
        continue;

      for (const [identStr, linkHashes] of rootLinks) {
        const ident = structUtils.parseIdent(identStr);

        // This dependent may have a peer dep itself, in which case it's not
        // the true root, and we can ignore it
        if (dependent.peerDependencies.has(ident.identHash))
          continue;

        const hash = `p${hashUtils.makeHash(dependentHash, identStr, rootHash).slice(0, 5)}`;

        peerRequirements.set(hash, {
          subject: dependentHash,
          requested: ident,
          rootRequester: rootHash,
          allRequesters: linkHashes,
        });

        // Note: this can be undefined when the peer dependency isn't provided at all
        const resolvedDescriptor = root.dependencies.get(ident.identHash);

        if (typeof resolvedDescriptor !== `undefined`) {
          const peerResolution = getPackageFromDescriptor(resolvedDescriptor);
          const peerVersion = peerResolution.version ?? `0.0.0`;

          const ranges = new Set<string>();
          for (const linkHash of linkHashes) {
            const link = allPackages.get(linkHash);
            if (typeof link === `undefined`)
              throw new Error(`Assertion failed: Expected the link to be registered`);

            const peerDependency = link.peerDependencies.get(ident.identHash);
            if (typeof peerDependency === `undefined`)
              throw new Error(`Assertion failed: Expected the ident to be registered`);

            ranges.add(peerDependency.range);
          }

          const satisfiesAll = [...ranges].every(range => {
            return semverUtils.satisfiesWithPrereleases(peerVersion, range);
          });

          if (!satisfiesAll) {
            warnings.push({
              type: WarningType.NotCompatible,
              subject: dependent,
              requested: ident,
              requester: root,
              version: peerVersion,
              hash,
              requirementCount: linkHashes.length,
            });
          }
        } else {
          const peerDependencyMeta = root.peerDependenciesMeta.get(identStr);

          if (!peerDependencyMeta?.optional) {
            warnings.push({
              type: WarningType.NotProvided,
              subject: dependent,
              requested: ident,
              requester: root,
              hash,
            });
          }
        }
      }
    }
  }

  const warningSortCriterias: Array<((warning: Warning) => string)> = [
    warning => structUtils.prettyLocatorNoColors(warning.subject),
    warning => structUtils.stringifyIdent(warning.requested),
    warning => `${warning.type}`,
  ];

  for (const warning of miscUtils.sortMap(warnings, warningSortCriterias)) {
    switch (warning.type) {
      case WarningType.NotProvided: {
        report?.reportWarning(MessageName.MISSING_PEER_DEPENDENCY, `${
          structUtils.prettyLocator(project.configuration, warning.subject)
        } doesn't provide ${
          structUtils.prettyIdent(project.configuration, warning.requested)
        } (${
          formatUtils.pretty(project.configuration, warning.hash, formatUtils.Type.CODE)
        }), requested by ${
          structUtils.prettyIdent(project.configuration, warning.requester)
        }`);
      } break;

      case WarningType.NotCompatible: {
        const andDescendants = warning.requirementCount > 1
          ? `and some of its descendants request`
          : `requests`;

        report?.reportWarning(MessageName.INCOMPATIBLE_PEER_DEPENDENCY, `${
          structUtils.prettyLocator(project.configuration, warning.subject)
        } provides ${
          structUtils.prettyIdent(project.configuration, warning.requested)
        } (${
          formatUtils.pretty(project.configuration, warning.hash, formatUtils.Type.CODE)
        }) with version ${
          structUtils.prettyReference(project.configuration, warning.version)
        }, which doesn't satisfy what ${
          structUtils.prettyIdent(project.configuration, warning.requester)
        } ${andDescendants}`);
      } break;
    }
  }

  if (warnings.length > 0) {
    report?.reportWarning(MessageName.UNNAMED, `Some peer dependencies are incorrectly met; run ${formatUtils.pretty(project.configuration, `yarn explain peer-requirements <hash>`, formatUtils.Type.CODE)} for details, where ${formatUtils.pretty(project.configuration, `<hash>`, formatUtils.Type.CODE)} is the six-letter p-prefixed code`);
  }
}
