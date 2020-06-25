import {PortablePath, ppath, toFilename, xfs, normalizeLineEndings, Filename} from '@yarnpkg/fslib';
import {parseSyml, stringifySyml}                                             from '@yarnpkg/parsers';
import {UsageError}                                                           from 'clipanion';
import {createHash}                                                           from 'crypto';
import {structuredPatch}                                                      from 'diff';
// @ts-ignore
import Logic                                                                  from 'logic-solver';
import pLimit                                                                 from 'p-limit';
import semver                                                                 from 'semver';
import {promisify}                                                            from 'util';
import v8                                                                     from 'v8';
import zlib                                                                   from 'zlib';

import {Cache}                                                                from './Cache';
import {Configuration, FormatType}                                            from './Configuration';
import {Fetcher}                                                              from './Fetcher';
import {Installer, BuildDirective, BuildType}                                 from './Installer';
import {LegacyMigrationResolver}                                              from './LegacyMigrationResolver';
import {Linker}                                                               from './Linker';
import {LockfileResolver}                                                     from './LockfileResolver';
import {DependencyMeta, Manifest}                                             from './Manifest';
import {MessageName}                                                          from './MessageName';
import {MultiResolver}                                                        from './MultiResolver';
import {Report, ReportError}                                                  from './Report';
import {ResolveOptions, Resolver}                                             from './Resolver';
import {RunInstallPleaseResolver}                                             from './RunInstallPleaseResolver';
import {ThrowReport}                                                          from './ThrowReport';
import {Workspace}                                                            from './Workspace';
import {isFolderInside}                                                       from './folderUtils';
import * as hashUtils                                                         from './hashUtils';
import * as miscUtils                                                         from './miscUtils';
import * as scriptUtils                                                       from './scriptUtils';
import * as semverUtils                                                       from './semverUtils';
import * as structUtils                                                       from './structUtils';
import {IdentHash, DescriptorHash, LocatorHash}                               from './types';
import {Descriptor, Ident, Locator, Package}                                  from './types';
import {LinkType}                                                             from './types';

// When upgraded, the lockfile entries have to be resolved again (but the specific
// versions are still pinned, no worry). Bump it when you change the fields within
// the Package type; no more no less.
const LOCKFILE_VERSION = 4;

// Same thing but must be bumped when the members of the Project class changes (we
// don't recommend our users to check-in this file, so it's fine to bump it even
// between patch or minor releases).
const INSTALL_STATE_VERSION = 1;

const MULTIPLE_KEYS_REGEXP = / *, */g;

const FETCHER_CONCURRENCY = 32;

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export type InstallOptions = {
  cache: Cache,
  fetcher?: Fetcher,
  resolver?: Resolver
  report: Report,
  immutable?: boolean,
  lockfileOnly?: boolean,
  persistProject?: boolean,
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

  public accessibleLocators: Set<LocatorHash> = new Set();
  public originalPackages: Map<LocatorHash, Package> = new Map();
  public optionalBuilds: Set<LocatorHash> = new Set();

  public lockFileChecksum: string | null = null;

  static async find(configuration: Configuration, startingCwd: PortablePath): Promise<{project: Project, workspace: Workspace | null, locator: Locator}> {
    if (!configuration.projectCwd)
      throw new UsageError(`No project found in ${startingCwd}`);

    let packageCwd = configuration.projectCwd;

    let nextCwd = startingCwd;
    let currentCwd = null;

    while (currentCwd !== configuration.projectCwd) {
      currentCwd = nextCwd;

      if (xfs.existsSync(ppath.join(currentCwd, toFilename(`package.json`)))) {
        packageCwd = currentCwd;
        break;
      }

      nextCwd = ppath.dirname(currentCwd);
    }

    const project = new Project(configuration.projectCwd, {configuration});

    await project.setupResolutions();
    await project.setupWorkspaces();

    // If we're in a workspace, no need to go any further to find which package we're in
    const workspace = project.tryWorkspaceByCwd(packageCwd);
    if (workspace)
      return {project, workspace, locator: workspace.anchoredLocator};

    // Otherwise, we need to ask the project (which will in turn ask the linkers for help)
    // Note: the trailing slash is caused by a quirk in the PnP implementation that requires folders to end with a trailing slash to disambiguate them from regular files
    const locator = await project.findLocatorForLocation(`${packageCwd}/` as PortablePath);
    if (locator)
      return {project, locator, workspace: null};

    throw new UsageError(`The nearest package directory (${packageCwd}) doesn't seem to be part of the project declared at ${project.cwd}. If the project directory is right, it might be that you forgot to list a workspace. If it isn't, it's likely because you have a yarn.lock file at the detected location, confusing the project detection.`);
  }

  static generateBuildStateFile(buildState: Map<LocatorHash, string>, locatorStore: Map<LocatorHash, Locator>) {
    let bstateFile = `# Warning: This file is automatically generated. Removing it is fine, but will\n# cause all your builds to become invalidated.\n`;

    const bstateData = [...buildState].map(([locatorHash, hash]) => {
      const locator = locatorStore.get(locatorHash);

      if (typeof locator === `undefined`)
        throw new Error(`Assertion failed: The locator should have been registered`);

      return [structUtils.stringifyLocator(locator), locator.locatorHash, hash];
    });

    for (const [locatorString, locatorHash, buildHash] of miscUtils.sortMap(bstateData, [d => d[0], d => d[1]])) {
      bstateFile += `\n`;
      bstateFile += `# ${locatorString}\n`;
      bstateFile += `${JSON.stringify(locatorHash)}:\n`;
      bstateFile += `  ${buildHash}\n`;
    }

    return bstateFile;
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
          manifest.load(data);

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
      throw new Error(`Duplicate workspace name ${structUtils.prettyIdent(this.configuration, workspace.locator)}: ${workspaceCwd} conflicts with ${dup.cwd}`);

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

    if (workspace === null || !workspace.accepts(descriptor.range))
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
    if (structUtils.isVirtualLocator(locator))
      locator = structUtils.devirtualizeLocator(locator);

    const workspace = this.tryWorkspaceByIdent(locator);
    if (workspace === null || (workspace.locator.locatorHash !== locator.locatorHash && workspace.anchoredLocator.locatorHash !== locator.locatorHash))
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
        throw new Error(`Assertion failed: Expected workspace to have been resolved`);

      workspace.dependencies = new Map(pkg.dependencies);
    }
  }

  forgetResolution(descriptor: Descriptor): void;
  forgetResolution(locator: Locator): void;
  forgetResolution(dataStructure: Descriptor | Locator): void {
    for (const [descriptorHash, locatorHash] of this.storedResolutions) {
      const doDescriptorHashesMatch = `descriptorHash` in dataStructure
        && dataStructure.descriptorHash === descriptorHash;
      const doLocatorHashesMatch = `locatorHash` in dataStructure
        && dataStructure.locatorHash === locatorHash;

      if (doDescriptorHashesMatch || doLocatorHashesMatch) {
        this.storedDescriptors.delete(descriptorHash);
        this.storedResolutions.delete(descriptorHash);
        this.originalPackages.delete(locatorHash);
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

  async findLocatorForLocation(cwd: PortablePath) {
    const report = new ThrowReport();

    const linkers = this.configuration.getLinkers();
    const linkerOptions = {project: this, report};

    for (const linker of linkers) {
      const locator = await linker.findPackageLocator(cwd, linkerOptions);
      if (locator) {
        return locator;
      }
    }

    return null;
  }

  async validateEverything(opts: {
    validationWarnings: Array<{name: MessageName, text: string}>,
    validationErrors: Array<{name: MessageName, text: string}>,
    report: Report,
  }) {
    for (const warning of opts.validationWarnings)
      opts.report.reportWarning(warning.name, warning.text);

    for (const error of opts.validationErrors) {
      opts.report.reportError(error.name, error.text);
    }
  }

  async resolveEverything(opts: {report: Report, lockfileOnly: true, resolver?: Resolver} | {report: Report, lockfileOnly?: boolean, cache: Cache, resolver?: Resolver}) {
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

    const resolutionDependencies = new Map<DescriptorHash, Set<DescriptorHash>>();
    const haveBeenAliased = new Set<DescriptorHash>();

    let nextResolutionPass = new Set<DescriptorHash>();

    for (const workspace of this.workspaces) {
      const workspaceDescriptor = workspace.anchoredDescriptor;

      allDescriptors.set(workspaceDescriptor.descriptorHash, workspaceDescriptor);
      nextResolutionPass.add(workspaceDescriptor.descriptorHash);
    }

    const limit = pLimit(10);

    while (nextResolutionPass.size !== 0) {
      const currentResolutionPass = nextResolutionPass;
      nextResolutionPass = new Set();

      // We remove from the "mustBeResolved" list all packages that have
      // already been resolved previously.

      for (const descriptorHash of currentResolutionPass)
        if (allResolutions.has(descriptorHash))
          currentResolutionPass.delete(descriptorHash);

      if (currentResolutionPass.size === 0)
        break;

      // We check that the resolution dependencies have been resolved for all
      // descriptors that we're about to resolve. Buffalo buffalo buffalo
      // buffalo.

      const deferredResolutions = new Set<DescriptorHash>();
      const resolvedDependencies = new Map<DescriptorHash, Map<DescriptorHash, Package>>();

      for (const descriptorHash of currentResolutionPass) {
        const descriptor = allDescriptors.get(descriptorHash);
        if (!descriptor)
          throw new Error(`Assertion failed: The descriptor should have been registered`);

        let dependencies = resolutionDependencies.get(descriptorHash);
        if (typeof dependencies === `undefined`) {
          resolutionDependencies.set(descriptorHash, dependencies = new Set());

          for (const dependency of resolver.getResolutionDependencies(descriptor, resolveOptions)) {
            allDescriptors.set(dependency.descriptorHash, dependency);
            dependencies.add(dependency.descriptorHash);
          }
        }

        const resolved = miscUtils.getMapWithDefault(resolvedDependencies, descriptorHash);

        for (const dependencyHash of dependencies) {
          const resolution = allResolutions.get(dependencyHash);

          if (typeof resolution !== `undefined`) {
            const dependencyPkg = allPackages.get(resolution);
            if (typeof dependencyPkg === `undefined`)
              throw new Error(`Assertion failed: The package should have been registered`);

            // The dependency is ready. We register it into the map so
            // that we can pass that to getCandidates right after.
            resolved.set(dependencyHash, dependencyPkg);
          } else {
            // One of the resolution dependencies of this descriptor is
            // missing; we need to postpone its resolution for now.
            deferredResolutions.add(descriptorHash);

            // For this pass however we'll want to schedule the resolution
            // of the dependency (so that it's probably ready next pass).
            currentResolutionPass.add(dependencyHash);
          }
        }
      }

      // Note: we're postponing the resolution only once we already know all
      // those that are going to be postponed. This way we can detect
      // potential cyclic dependencies.

      for (const descriptorHash of deferredResolutions) {
        currentResolutionPass.delete(descriptorHash);
        nextResolutionPass.add(descriptorHash);
      }

      if (currentResolutionPass.size === 0)
        throw new Error(`Assertion failed: Descriptors should not have cyclic dependencies`);

      // Then we request the resolvers for the list of possible references that
      // match the given ranges. That will give us a set of candidate references
      // for each descriptor.

      const passCandidates = new Map(await Promise.all(Array.from(currentResolutionPass).map(descriptorHash => limit(async () => {
        const descriptor = allDescriptors.get(descriptorHash);
        if (typeof descriptor === `undefined`)
          throw new Error(`Assertion failed: The descriptor should have been registered`);

        const descriptorDependencies = resolvedDependencies.get(descriptor.descriptorHash);
        if (typeof descriptorDependencies === `undefined`)
          throw new Error(`Assertion failed: The descriptor dependencies should have been registered`);

        let candidateLocators;
        try {
          candidateLocators = await resolver.getCandidates(descriptor, descriptorDependencies, resolveOptions);
        } catch (error) {
          error.message = `${structUtils.prettyDescriptor(this.configuration, descriptor)}: ${error.message}`;
          throw error;
        }

        if (candidateLocators.length === 0)
          throw new Error(`No candidate found for ${structUtils.prettyDescriptor(this.configuration, descriptor)}`);

        return [descriptor.descriptorHash, candidateLocators] as [DescriptorHash, Array<Locator>];
      }))));

      // That's where we'll store our resolutions until everything has been
      // resolved and can be injected into the various stores.
      //
      // The reason we're storing them in a temporary store instead of writing
      // them directly into the global ones is that otherwise we would end up
      // with different store orderings between dependency loaded from a
      // lockfiles and those who don't (when using a lockfile all descriptors
      // will fall into the next shortcut, but when no lockfile is there only
      // some of them will; since maps are sorted by insertion, it would affect
      // the way they would be ordered).

      const passResolutions = new Map<DescriptorHash, Locator>();

      // We now make a pre-pass to automatically resolve the descriptors that
      // can only be satisfied by a single reference.

      for (const [descriptorHash, candidateLocators] of passCandidates) {
        if (candidateLocators.length !== 1)
          continue;

        passResolutions.set(descriptorHash, candidateLocators[0]);
        passCandidates.delete(descriptorHash);
      }

      // We make a second pre-pass to automatically resolve the descriptors
      // that can be satisfied by a package we're already using (deduplication).

      for (const [descriptorHash, candidateLocators] of passCandidates) {
        const selectedLocator = candidateLocators.find(locator => allPackages.has(locator.locatorHash));
        if (!selectedLocator)
          continue;

        passResolutions.set(descriptorHash, selectedLocator);
        passCandidates.delete(descriptorHash);
      }

      // All entries that remain in "passCandidates" are from descriptors that
      // we haven't been able to resolve in the first place. We'll now configure
      // our SAT solver so that it can figure it out for us. To do this, we
      // simply add a constraint for each descriptor that lists all the
      // descriptors it would accept. We don't have to check whether the
      // locators obtained have already been selected, because if they were the
      // would have been resolved in the previous step (we never backtrace to
      // try to find better solutions, it would be a too expensive process - we
      // just want to get an acceptable solution, not the very best one).

      if (passCandidates.size > 0) {
        const solver = new Logic.Solver();

        for (const candidateLocators of passCandidates.values())
          solver.require(Logic.or(...candidateLocators.map(locator => locator.locatorHash)));

        let remainingSolutions = 100;
        let solution;

        let bestSolution = null;
        let bestScore = Infinity;

        while (remainingSolutions > 0 && (solution = solver.solve()) !== null) {
          const trueVars = solution.getTrueVars();
          solver.forbid(solution.getFormula());

          if (trueVars.length < bestScore) {
            bestSolution = trueVars;
            bestScore = trueVars.length;
          }

          remainingSolutions -= 1;
        }

        if (!bestSolution)
          throw new Error(`Assertion failed: No resolution found by the SAT solver`);

        const solutionSet = new Set<LocatorHash>(bestSolution as Array<LocatorHash>);

        for (const [descriptorHash, candidateLocators] of passCandidates.entries()) {
          const selectedLocator = candidateLocators.find(locator => solutionSet.has(locator.locatorHash));
          if (!selectedLocator)
            throw new Error(`Assertion failed: The descriptor should have been solved during the previous step`);

          passResolutions.set(descriptorHash, selectedLocator);
          passCandidates.delete(descriptorHash);
        }
      }

      // We now iterate over the locators we've got and, for each of them that
      // hasn't been seen before, we fetch its dependency list and schedule
      // them for the next cycle.

      const newLocators = Array.from(passResolutions.values()).filter(locator => {
        return !allPackages.has(locator.locatorHash);
      });

      const newPackages = new Map(await Promise.all(newLocators.map(async locator => {
        const original = await miscUtils.prettifyAsyncErrors(async () => {
          return await resolver.resolve(locator, resolveOptions);
        }, message => {
          return `${structUtils.prettyLocator(this.configuration, locator)}: ${message}`;
        });

        if (!structUtils.areLocatorsEqual(locator, original))
          throw new Error(`Assertion failed: The locator cannot be changed by the resolver (went from ${structUtils.prettyLocator(this.configuration, locator)} to ${structUtils.prettyLocator(this.configuration, original)})`);

        const pkg = this.configuration.normalizePackage(original);

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

        return [pkg.locatorHash, {original, pkg}] as const;
      })));

      // Now that the resolution is finished, we can finally insert the data
      // stored inside our pass stores into the resolution ones (we now have
      // the guarantee that they'll always be inserted into in the same order,
      // since mustBeResolved is stable regardless of the order in which the
      // resolvers return)

      for (const descriptorHash of currentResolutionPass) {
        const locator = passResolutions.get(descriptorHash);
        if (!locator)
          throw new Error(`Assertion failed: The locator should have been registered`);

        allResolutions.set(descriptorHash, locator.locatorHash);

        // If undefined it means that the package was already known and thus
        // didn't need to be resolved again.
        const resolutionEntry = newPackages.get(locator.locatorHash);
        if (typeof resolutionEntry === `undefined`)
          continue;

        const {original, pkg} = resolutionEntry;

        originalPackages.set(original.locatorHash, original);
        allPackages.set(pkg.locatorHash, pkg);

        for (const descriptor of pkg.dependencies.values()) {
          allDescriptors.set(descriptor.descriptorHash, descriptor);
          nextResolutionPass.add(descriptor.descriptorHash);

          // We must check and make sure that the descriptor didn't get aliased
          // to something else
          const aliasHash = this.resolutionAliases.get(descriptor.descriptorHash);
          if (aliasHash === undefined)
            continue;

          // It doesn't cost us much to support the case where a descriptor is
          // equal to its own alias (which should mean "no alias")
          if (descriptor.descriptorHash === aliasHash)
            continue;

          const alias = this.storedDescriptors.get(aliasHash);
          if (!alias)
            throw new Error(`Assertion failed: The alias should have been registered`);

          // If it's already been "resolved" (in reality it will be the temporary
          // resolution we've set in the next few lines) we simply must skip it
          if (allResolutions.has(descriptor.descriptorHash))
            continue;

          // Temporarily set an invalid resolution so that it won't be resolved
          // multiple times if it is found multiple times in the dependency
          // tree (this is only temporary, we will replace it by the actual
          // resolution after we've finished resolving everything)
          allResolutions.set(descriptor.descriptorHash, `temporary` as LocatorHash);

          // We can now replace the descriptor by its alias in the list of
          // descriptors that must be resolved
          nextResolutionPass.delete(descriptor.descriptorHash);
          nextResolutionPass.add(aliasHash);

          allDescriptors.set(aliasHash, alias);

          haveBeenAliased.add(descriptor.descriptorHash);
        }
      }
    }

    // Each package that should have been resolved but was skipped because it
    // was aliased will now see the resolution for its alias propagated to it

    while (haveBeenAliased.size > 0) {
      let hasChanged = false;

      for (const descriptorHash of haveBeenAliased) {
        const descriptor = allDescriptors.get(descriptorHash);
        if (!descriptor)
          throw new Error(`Assertion failed: The descriptor should have been registered`);

        const aliasHash = this.resolutionAliases.get(descriptorHash);
        if (aliasHash === undefined)
          throw new Error(`Assertion failed: The descriptor should have an alias`);

        const resolution = allResolutions.get(aliasHash);
        if (resolution === undefined)
          throw new Error(`Assertion failed: The resolution should have been registered`);

        // The following can happen if a package gets aliased to another package
        // that's itself aliased - in this case we just process all those we can
        // do, then make new passes until everything is resolved
        if (resolution === `temporary`)
          continue;

        haveBeenAliased.delete(descriptorHash);

        allResolutions.set(descriptorHash, resolution);

        hasChanged = true;
      }

      if (!hasChanged) {
        throw new Error(`Alias loop detected`);
      }
    }

    // In this step we now create virtual packages for each package with at
    // least one peer dependency. We also use it to search for the alias
    // descriptors that aren't depended upon by anything and can be safely
    // pruned.

    const volatileDescriptors = new Set(this.resolutionAliases.values());
    const optionalBuilds = new Set(allPackages.keys());
    const accessibleLocators = new Set<LocatorHash>();

    applyVirtualResolutionMutations({
      project: this,
      report: opts.report,

      accessibleLocators,
      volatileDescriptors,
      optionalBuilds,

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

    // Now that the internal resolutions have been updated, we can refresh the
    // dependencies of each resolved workspace's `Workspace` instance.

    this.refreshWorkspaceDependencies();
  }

  async fetchEverything({cache, report, fetcher: userFetcher}: InstallOptions) {
    const fetcher = userFetcher || this.configuration.makeFetcher();
    const fetcherOptions = {checksums: this.storedChecksums, project: this, cache, fetcher, report};

    const locatorHashes = miscUtils.sortMap(this.storedResolutions.values(), [(locatorHash: LocatorHash) => {
      const pkg = this.storedPackages.get(locatorHash);
      if (!pkg)
        throw new Error(`Assertion failed: The locator should have been registered`);

      return structUtils.stringifyLocator(pkg);
    }]);

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

  async linkEverything({cache, report, fetcher: optFetcher}: InstallOptions) {
    const fetcher = optFetcher || this.configuration.makeFetcher();
    const fetcherOptions = {checksums: this.storedChecksums, project: this, cache, fetcher, report, skipIntegrityCheck: true};

    const linkers = this.configuration.getLinkers();
    const linkerOptions = {project: this, report};

    const installers = new Map(linkers.map(linker => {
      return [linker, linker.makeInstaller(linkerOptions)] as [Linker, Installer];
    }));

    const packageLinkers: Map<LocatorHash, Linker> = new Map();
    const packageLocations: Map<LocatorHash, PortablePath | null> = new Map();
    const packageBuildDirectives: Map<LocatorHash, { directives: Array<BuildDirective>, buildLocations: Array<PortablePath> }> = new Map();

    // Step 1: Installing the packages on the disk

    for (const locatorHash of this.accessibleLocators) {
      const pkg = this.storedPackages.get(locatorHash);
      if (!pkg)
        throw new Error(`Assertion failed: The locator should have been registered`);

      const fetchResult = await fetcher.fetch(pkg, fetcherOptions);

      if (this.tryWorkspaceByLocator(pkg) !== null) {
        const buildScripts: Array<BuildDirective> = [];
        const {scripts} = await Manifest.find(fetchResult.prefixPath, {baseFs: fetchResult.packageFs});

        for (const scriptName of [`preinstall`, `install`, `postinstall`])
          if (scripts.has(scriptName))
            buildScripts.push([BuildType.SCRIPT, scriptName]);

        try {
          for (const installer of installers.values()) {
            await installer.installPackage(pkg, fetchResult);
          }
        } finally {
          if (fetchResult.releaseFs) {
            fetchResult.releaseFs();
          }
        }

        const location = ppath.join(fetchResult.packageFs.getRealPath(), fetchResult.prefixPath);
        packageLocations.set(pkg.locatorHash, location);

        if (buildScripts.length > 0) {
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
          await linkPackage(packageLinker, installer);
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

    for (const installer of installers.values()) {
      const installStatuses = await installer.finalizeInstall();
      if (installStatuses) {
        for (const installStatus of installStatuses) {
          if (installStatus.buildDirective) {
            packageBuildDirectives.set(installStatus.locatorHash!, {
              directives: installStatus.buildDirective,
              buildLocations: installStatus.buildLocations,
            });
          }
        }
      }
    }

    // Step 4: Build the packages in multiple steps

    const readyPackages = new Set(this.storedPackages.keys());
    const buildablePackages = new Set(packageBuildDirectives.keys());

    for (const locatorHash of buildablePackages)
      readyPackages.delete(locatorHash);

    const globalHashGenerator = createHash(`sha512`);
    globalHashGenerator.update(process.versions.node);

    this.configuration.triggerHook(hooks => {
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

        builder.update(getBaseHash(pkg));
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

    const bstatePath: PortablePath = this.configuration.get(`bstatePath`);
    const bstate = xfs.existsSync(bstatePath)
      ? parseSyml(await xfs.readFilePromise(bstatePath, `utf8`)) as {[key: string]: string}
      : {};

    // We reconstruct the build state from an empty object because we want to
    // remove the state from packages that got removed
    const nextBState = new Map<LocatorHash, string>();

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
        if (Object.prototype.hasOwnProperty.call(bstate, pkg.locatorHash) && bstate[pkg.locatorHash] === buildHash) {
          nextBState.set(pkg.locatorHash, buildHash);
          continue;
        }

        if (Object.prototype.hasOwnProperty.call(bstate, pkg.locatorHash))
          report.reportInfo(MessageName.MUST_REBUILD, `${structUtils.prettyLocator(this.configuration, pkg)} must be rebuilt because its dependency tree changed`);
        else
          report.reportInfo(MessageName.MUST_BUILD, `${structUtils.prettyLocator(this.configuration, pkg)} must be built because it never did before or the last one failed`);

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

              await xfs.mktempPromise(async logDir => {
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

                const buildMessage = `${structUtils.prettyLocator(this.configuration, pkg)} couldn't be built successfully (exit code ${this.configuration.format(String(exitCode), FormatType.NUMBER)}, logs can be found here: ${this.configuration.format(logFile, FormatType.PATH)})`;
                report.reportInfo(MessageName.BUILD_FAILED, buildMessage);

                if (this.optionalBuilds.has(pkg.locatorHash)) {
                  nextBState.set(pkg.locatorHash, buildHash);
                  return true;
                }

                report.reportError(MessageName.BUILD_FAILED, buildMessage);
                return false;
              });
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

    // We can now generate the bstate file, which will allow us to "remember"
    // what's the dependency tree subset that we used to build a specific
    // package (and avoid rebuilding it later if it didn't change).

    if (nextBState.size > 0) {
      const bstatePath = this.configuration.get<PortablePath>(`bstatePath`);
      const bstateFile = Project.generateBuildStateFile(nextBState, this.storedPackages);

      await xfs.mkdirpPromise(ppath.dirname(bstatePath));
      await xfs.changeFilePromise(bstatePath, bstateFile, {
        automaticNewlines: true,
      });
    } else {
      await xfs.removePromise(bstatePath);
    }
  }

  async install(opts: InstallOptions) {
    const validationWarnings: Array<{name: MessageName, text: string}> = [];
    const validationErrors: Array<{name: MessageName, text: string}> = [];

    await this.configuration.triggerHook(hooks => {
      return hooks.validateProject;
    }, this, {
      reportWarning: (name: MessageName, text: string) => validationWarnings.push({name, text}),
      reportError: (name: MessageName, text: string) => validationErrors.push({name, text}),
    });

    const problemCount = validationWarnings.length + validationErrors.length;

    if (problemCount > 0) {
      await opts.report.startTimerPromise(`Validation step`, async () => {
        await this.validateEverything({validationWarnings, validationErrors, report: opts.report});
      });
    }

    await opts.report.startTimerPromise(`Resolution step`, async () => {
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

      await this.resolveEverything(opts);

      if (initialLockfile !== null) {
        const newLockfile = normalizeLineEndings(initialLockfile, this.generateLockfile());

        if (newLockfile !== initialLockfile) {
          const diff = structuredPatch(lockfilePath, lockfilePath, initialLockfile, newLockfile);

          opts.report.reportSeparator();

          for (const hunk of diff.hunks) {
            opts.report.reportInfo(null, `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`);
            for (const line of hunk.lines) {
              if (line.startsWith(`+`)) {
                opts.report.reportError(MessageName.FROZEN_LOCKFILE_EXCEPTION, this.configuration.format(line, FormatType.ADDED));
              } else if (line.startsWith(`-`)) {
                opts.report.reportError(MessageName.FROZEN_LOCKFILE_EXCEPTION, this.configuration.format(line, FormatType.REMOVED));
              } else {
                opts.report.reportInfo(null, this.configuration.format(line, `grey`));
              }
            }
          }

          opts.report.reportSeparator();

          throw new ReportError(MessageName.FROZEN_LOCKFILE_EXCEPTION, `The lockfile would have been modified by this install, which is explicitly forbidden.`);
        }
      }
    });

    await opts.report.startTimerPromise(`Fetch step`, async () => {
      await this.fetchEverything(opts);

      if (typeof opts.persistProject === `undefined` || opts.persistProject) {
        await this.cacheCleanup(opts);
      }
    });

    if (typeof opts.persistProject === `undefined` || opts.persistProject)
      await this.persist();

    await opts.report.startTimerPromise(`Link step`, async () => {
      await this.linkEverything(opts);
    });

    await this.configuration.triggerHook(hooks => {
      return hooks.afterAllInstalled;
    }, this);
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
    const {accessibleLocators, optionalBuilds, storedDescriptors, storedResolutions, storedPackages, lockFileChecksum} = this;
    const installState = {accessibleLocators, optionalBuilds, storedDescriptors, storedResolutions, storedPackages, lockFileChecksum};
    const serializedState = await gzip(v8.serialize(installState));

    const installStatePath = this.configuration.get<PortablePath>(`installStatePath`);

    await xfs.mkdirpPromise(ppath.dirname(installStatePath));
    await xfs.writeFilePromise(installStatePath, serializedState as Buffer);
  }

  async restoreInstallState() {
    const installStatePath = this.configuration.get<PortablePath>(`installStatePath`);
    if (!xfs.existsSync(installStatePath)) {
      await this.applyLightResolution();
      return;
    }

    const serializedState = await xfs.readFilePromise(installStatePath);
    const installState = v8.deserialize(await gunzip(serializedState) as Buffer);

    if (installState.lockFileChecksum !== this.lockFileChecksum) {
      await this.applyLightResolution();
      return;
    }

    Object.assign(this, installState);

    this.refreshWorkspaceDependencies();
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
    await this.persistInstallStateFile();

    for (const workspace of this.workspacesByCwd.values()) {
      await workspace.persistManifest();
    }
  }

  async cacheCleanup({cache, report}: InstallOptions)  {
    const PRESERVED_FILES = new Set([
      `.gitignore`,
    ]);

    if (!xfs.existsSync(cache.cwd))
      return;

    if (!isFolderInside(cache.cwd, this.cwd))
      return;

    for (const entry of await xfs.readdirPromise(cache.cwd)) {
      if (PRESERVED_FILES.has(entry))
        continue;

      const entryPath = ppath.resolve(cache.cwd, entry);
      if (cache.markedFiles.has(entryPath))
        continue;

      if (cache.immutable) {
        report.reportError(MessageName.IMMUTABLE_CACHE, `${this.configuration.format(ppath.basename(entryPath), `magenta`)} appears to be unused and would marked for deletion, but the cache is immutable`);
      } else {
        report.reportInfo(MessageName.UNUSED_CACHE_ENTRY, `${this.configuration.format(ppath.basename(entryPath), `magenta`)} appears to be unused - removing`);
        await xfs.unlinkPromise(entryPath);
      }
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

  report: Report | null,

  tolerateMissingPackages?: boolean,
}) {
  const virtualStack = new Map<LocatorHash, number>();
  const resolutionStack: Array<Locator> = [];

  // We'll be keeping track of all virtual descriptors; once they have all
  // been generated we'll check whether they can be consolidated into one.
  const allVirtualInstances = new Map<LocatorHash, Map<string, Descriptor>>();
  const allVirtualDependents = new Map<DescriptorHash, Set<LocatorHash>>();

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

    throw new ReportError(MessageName.STACK_OVERFLOW_RESOLUTION, `Encountered a stack overflow when resolving peer dependencies; cf ${logFile}`);
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

  const resolvePeerDependencies = (parentLocator: Locator, first: boolean, optional: boolean) => {
    if (resolutionStack.length > 1000)
      reportStackOverflow();

    resolutionStack.push(parentLocator);
    const result = resolvePeerDependenciesImpl(parentLocator, first, optional);
    resolutionStack.pop();

    return result;
  };

  const resolvePeerDependenciesImpl = (parentLocator: Locator, first: boolean, optional: boolean) => {
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
      if (parentPackage.peerDependencies.has(descriptor.identHash) && !first)
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
        resolvePeerDependencies(pkg, false, isOptional);
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
        for (const peerRequest of virtualizedPackage.peerDependencies.values()) {
          let peerDescriptor = parentPackage.dependencies.get(peerRequest.identHash);

          if (!peerDescriptor && structUtils.areIdentsEqual(parentLocator, peerRequest)) {
            peerDescriptor = structUtils.convertLocatorToDescriptor(parentLocator);

            allDescriptors.set(peerDescriptor.descriptorHash, peerDescriptor);
            allResolutions.set(peerDescriptor.descriptorHash, parentLocator.locatorHash);

            volatileDescriptors.delete(peerDescriptor.descriptorHash);
          }

          if (!peerDescriptor && virtualizedPackage.dependencies.has(peerRequest.identHash)) {
            virtualizedPackage.peerDependencies.delete(peerRequest.identHash);
            continue;
          }

          if (!peerDescriptor) {
            if (!parentPackage.peerDependencies.has(peerRequest.identHash)) {
              const peerDependencyMeta = virtualizedPackage.peerDependenciesMeta.get(structUtils.stringifyIdent(peerRequest));

              if (report !== null && (!peerDependencyMeta || !peerDependencyMeta.optional)) {
                report.reportWarning(MessageName.MISSING_PEER_DEPENDENCY, `${structUtils.prettyLocator(project.configuration, parentLocator)} doesn't provide ${structUtils.prettyDescriptor(project.configuration, peerRequest)} requested by ${structUtils.prettyLocator(project.configuration, pkg)}`);
              }
            }

            peerDescriptor = structUtils.makeDescriptor(peerRequest, `missing:`);
          }

          virtualizedPackage.dependencies.set(peerDescriptor.identHash, peerDescriptor);

          // Need to track when a virtual descriptor is set as a dependency in case
          // the descriptor will be consolidated.
          if (structUtils.isVirtualDescriptor(peerDescriptor)) {
            const dependents = miscUtils.getSetWithDefault(allVirtualDependents, peerDescriptor.descriptorHash);
            dependents.add(virtualizedPackage.locatorHash);
          }

          if (peerDescriptor.range === `missing:`) {
            missingPeerDependencies.add(peerDescriptor.identHash);
          } else if (report !== null) {
            // When the parent provides the peer dependency request it must be checked to ensure
            // it is a compatible version.
            const peerPackage = getPackageFromDescriptor(peerDescriptor);
            if (!semverUtils.satisfiesWithPrereleases(peerPackage.version, peerRequest.range)) {
              report.reportWarning(MessageName.INCOMPATIBLE_PEER_DEPENDENCY, `${structUtils.prettyLocator(project.configuration, parentLocator)} provides ${structUtils.prettyLocator(project.configuration, peerPackage)} with version ${peerPackage.version} which doesn't satisfy ${structUtils.prettyRange(project.configuration, peerRequest.range)} requested by ${structUtils.prettyLocator(project.configuration, pkg)}`);
            }
          }
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
        resolvePeerDependencies(virtualizedPackage, false, isOptional);
        virtualStack.set(pkg.locatorHash, next - 1);
      });

      fourthPass.push(() => {
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
        if (!allPackages.has(virtualPackage.locatorHash))
          continue;

        const otherVirtualInstances = miscUtils.getMapWithDefault(allVirtualInstances, physicalLocator.locatorHash);

        // We take all the dependencies from the new virtual instance and
        // generate a hash from it. By checking if this hash is already
        // registered, we know whether we can trim the new version.
        const dependencyHash = hashUtils.makeHash(...[...virtualPackage.dependencies.values()].map(descriptor => {
          const resolution = descriptor.range !== `missing:`
            ? allResolutions.get(descriptor.descriptorHash)
            : `missing:`;

          if (typeof resolution === `undefined`)
            throw new Error(`Assertion failed: Expected the resolution for ${structUtils.prettyDescriptor(project.configuration, descriptor)} to have been registered`);

          return resolution;
        }));

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
    volatileDescriptors.delete(workspace.anchoredDescriptor.descriptorHash);
    resolvePeerDependencies(workspace.anchoredLocator, true, false);
  }
}
