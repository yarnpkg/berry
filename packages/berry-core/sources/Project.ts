import {xfs, NodeFS, PortablePath, ppath, toFilename} from '@berry/fslib';
import {parseSyml, stringifySyml}                     from '@berry/parsers';
import {createHmac}                                   from 'crypto';
// @ts-ignore
import Logic                                          from 'logic-solver';
import pLimit                                         from 'p-limit';
import semver                                         from 'semver';
import {tmpNameSync}                                  from 'tmp';

import {AliasResolver}                                from './AliasResolver';
import {Cache}                                        from './Cache';
import {Configuration}                                from './Configuration';
import {Fetcher}                                      from './Fetcher';
import {Installer, BuildDirective, BuildType}         from './Installer';
import {Linker}                                       from './Linker';
import {LockfileResolver}                             from './LockfileResolver';
import {DependencyMeta, Manifest}                     from './Manifest';
import {MultiResolver}                                from './MultiResolver';
import {Report, ReportError, MessageName}             from './Report';
import {RunInstallPleaseResolver}                     from './RunInstallPleaseResolver';
import {ThrowReport}                                  from './ThrowReport';
import {Workspace}                                    from './Workspace';
import {YarnResolver}                                 from './YarnResolver';
import {isFolderInside}                               from './folderUtils';
import * as miscUtils                                 from './miscUtils';
import * as scriptUtils                               from './scriptUtils';
import * as structUtils                               from './structUtils';
import {IdentHash, DescriptorHash, LocatorHash}       from './types';
import {Descriptor, Ident, Locator, Package}          from './types';
import {LinkType}                                     from './types';

// When upgraded, the lockfile entries have to be resolved again (but the specific
// versions are still pinned, no worry). Bump it when you change the fields within
// the Package type; no more no less.
const LOCKFILE_VERSION = 3;

const MULTIPLE_KEYS_REGEXP = / *, */g;

export type InstallOptions = {
  cache: Cache,
  fetcher?: Fetcher,
  report: Report,
  frozenLockfile?: boolean,
  lockfileOnly?: boolean,
  inlineBuilds?: boolean,
};

export class Project {
  public readonly configuration: Configuration;
  public readonly cwd: PortablePath;

  // Is meant to be populated by the consumer. When the descriptor referenced by
  // the key should be resolved, the second one is resolved instead and its
  // result is used as final resolution for the first entry.
  public resolutionAliases: Map<DescriptorHash, DescriptorHash> = new Map();

  public workspaces: Array<Workspace> = [];

  public workspacesByCwd: Map<PortablePath, Workspace> = new Map();
  public workspacesByLocator: Map<LocatorHash, Workspace> = new Map();
  public workspacesByIdent: Map<IdentHash, Array<Workspace>> = new Map();

  public storedResolutions: Map<DescriptorHash, LocatorHash> = new Map();

  public storedDescriptors: Map<DescriptorHash, Descriptor> = new Map();
  public storedPackages: Map<LocatorHash, Package> = new Map();
  public storedChecksums: Map<LocatorHash, string> = new Map();

  public optionalBuilds: Set<LocatorHash> = new Set();

  static async find(configuration: Configuration, startingCwd: PortablePath): Promise<{project: Project, workspace: Workspace | null, locator: Locator}> {
    if (!configuration.projectCwd)
      throw new Error(`No project found in the initial directory`);

    let packageCwd = null;

    let nextCwd = startingCwd;
    let currentCwd = null;

    while (currentCwd !== configuration.projectCwd) {
      currentCwd = nextCwd;

      if (xfs.existsSync(ppath.join(currentCwd, toFilename(`package.json`))))
        if (!packageCwd)
          packageCwd = currentCwd;

      nextCwd = ppath.dirname(currentCwd);
    }

    if (!packageCwd)
      throw new Error(`Assertion failed: No manifest found in the project`);

    const project = new Project(configuration.projectCwd, {configuration});

    await project.setupResolutions();
    await project.setupWorkspaces();

    applyVirtualResolutionMutations({
      project,

      allDescriptors: project.storedDescriptors,
      allResolutions: project.storedResolutions,
      allPackages: project.storedPackages,

      report: null,

      tolerateMissingPackages: true,
    });

    // If we're in a workspace, no need to go any further to find which package we're in
    const workspace = project.tryWorkspaceByCwd(packageCwd);
    if (workspace)
      return {project, workspace, locator: workspace.anchoredLocator};

    // Otherwise, we need to ask the project (which will in turn ask the linkers for help)
    // Note: the trailing slash is caused by a quirk in the PnP implementation that requires folders to end with a trailing slash to disambiguate them from regular files
    const locator = await project.findLocatorForLocation(`${packageCwd}/` as PortablePath);
    if (locator)
      return {project, locator, workspace: null};

    throw new Error(`Assertion failed: The package should have been detected as part of the project`);
  }

  constructor(projectCwd: PortablePath, {configuration}: {configuration: Configuration}) {
    this.configuration = configuration;
    this.cwd = projectCwd;
  }

  private async setupResolutions() {
    this.storedResolutions = new Map();

    this.storedDescriptors = new Map();
    this.storedPackages = new Map();

    const lockfilePath = ppath.join(this.cwd, this.configuration.get(`lockfileFilename`));
    const defaultLanguageName = this.configuration.get(`defaultLanguageName`);

    if (xfs.existsSync(lockfilePath)) {
      const content = await xfs.readFilePromise(lockfilePath, `utf8`);
      const parsed: any = parseSyml(content);

      // Protects against v1 lockfiles
      if (parsed.__metadata) {
        const lockfileVersion = parsed.__metadata.version;

        for (const key of Object.keys(parsed)) {
          if (key === `__metadata`)
            continue;

          const data = parsed[key];
          const locator = structUtils.parseLocator(data.resolution, true);

          const manifest = new Manifest();
          manifest.load(data);

          const version = manifest.version;

          const languageName = manifest.languageName || defaultLanguageName;
          const linkType = data.linkType as LinkType;

          const dependencies = manifest.dependencies;
          const peerDependencies = manifest.peerDependencies;

          const dependenciesMeta = manifest.dependenciesMeta;
          const peerDependenciesMeta = manifest.peerDependenciesMeta;

          const bin = manifest.bin;

          if (data.checksum != null)
            this.storedChecksums.set(locator.locatorHash, data.checksum);

          if (lockfileVersion >= LOCKFILE_VERSION) {
            const pkg: Package = {...locator, version, languageName, linkType, dependencies, peerDependencies, dependenciesMeta, peerDependenciesMeta, bin};
            this.storedPackages.set(pkg.locatorHash, pkg);
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

  private async setupWorkspaces({force = false}: {force?: boolean} = {}) {
    this.workspaces = [];

    this.workspacesByCwd = new Map();
    this.workspacesByLocator = new Map();
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

    this.workspaces.push(workspace);

    this.workspacesByCwd.set(workspaceCwd, workspace);
    this.workspacesByLocator.set(workspace.anchoredLocator.locatorHash, workspace);

    let byIdent = this.workspacesByIdent.get(workspace.locator.identHash);
    if (!byIdent)
      this.workspacesByIdent.set(workspace.locator.identHash, byIdent = []);
    byIdent.push(workspace);

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

  getWorkspaceByFilePath(filePath: PortablePath) {
    let bestWorkspace = null;

    for (const workspace of this.workspaces) {
      const rel = ppath.relative(workspace.cwd, filePath);
      if (rel.startsWith(`../`))
        continue;

      if (bestWorkspace && bestWorkspace.cwd.length >= workspace.cwd.length)
        continue;

      bestWorkspace = workspace;
    }

    if (!bestWorkspace) {
      for (const workspace of this.workspaces)
        console.log(workspace.cwd);
      throw new Error(`Workspace not found (${filePath})`);
    }

    return bestWorkspace;
  }

  tryWorkspaceByLocator(locator: Locator) {
    if (structUtils.isVirtualLocator(locator))
      locator = structUtils.devirtualizeLocator(locator);

    const workspace = this.workspacesByLocator.get(locator.locatorHash);
    if (!workspace)
      return null;

    return workspace;
  }

  getWorkspaceByLocator(locator: Locator) {
    const workspace = this.tryWorkspaceByLocator(locator);
    if (!workspace)
      throw new Error(`Workspace not found (${structUtils.prettyLocator(this.configuration, locator)})`);

    return workspace;
  }

  findWorkspacesByDescriptor(descriptor: Descriptor) {
    const candidateWorkspaces = this.workspacesByIdent.get(descriptor.identHash);

    if (!candidateWorkspaces)
      return [];

    return candidateWorkspaces.filter(workspace => {
      return workspace.accepts(descriptor.range);
    });
  }

  forgetTransientResolutions() {
    const resolver = this.configuration.makeResolver();
    const forgottenPackages = new Set();

    for (const pkg of this.storedPackages.values()) {
      if (!resolver.shouldPersistResolution(pkg, {project: this, resolver})) {
        this.storedPackages.delete(pkg.locatorHash);
        forgottenPackages.add(pkg.locatorHash);
      }
    }

    for (const [descriptorHash, locatorHash] of this.storedResolutions) {
      if (forgottenPackages.has(locatorHash)) {
        this.storedResolutions.delete(descriptorHash);
        this.storedDescriptors.delete(descriptorHash);
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

  async resolveEverything({cache, report, lockfileOnly}: InstallOptions) {
    if (!this.workspacesByCwd || !this.workspacesByIdent)
      throw new Error(`Workspaces must have been setup before calling this function`);

    // Reverts the changes that have been applied to the tree because of any previous virtual resolution pass
    this.forgetVirtualResolutions();

    // Ensures that we notice it when dependencies are added / removed from all sources coming from the filesystem
    if (!lockfileOnly)
      await this.forgetTransientResolutions();

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

    const yarnResolver = new YarnResolver();
    await yarnResolver.setup(this, {report});

    const realResolver = this.configuration.makeResolver();

    const resolver = lockfileOnly
      ? new MultiResolver([new LockfileResolver(), new RunInstallPleaseResolver(realResolver)])
      : new AliasResolver(new MultiResolver([new LockfileResolver(), yarnResolver, realResolver]));

    const fetcher = this.configuration.makeFetcher();

    const resolverOptions = {checksums: this.storedChecksums, project: this, cache, fetcher, report, resolver};

    const allDescriptors = new Map<DescriptorHash, Descriptor>();
    const allPackages = new Map<LocatorHash, Package>();
    const allResolutions = new Map<DescriptorHash, LocatorHash>();

    const haveBeenAliased = new Set<DescriptorHash>();

    let mustBeResolved = new Set<DescriptorHash>();

    for (const workspace of this.workspaces) {
      const workspaceDescriptor = workspace.anchoredDescriptor;

      allDescriptors.set(workspaceDescriptor.descriptorHash, workspaceDescriptor);
      mustBeResolved.add(workspaceDescriptor.descriptorHash);
    }

    while (mustBeResolved.size !== 0) {
      // We remove from the "mustBeResolved" list all packages that have
      // already been resolved previously.

      for (const descriptorHash of mustBeResolved)
        if (allResolutions.has(descriptorHash))
          mustBeResolved.delete(descriptorHash);

      // Then we request the resolvers for the list of possible references that
      // match the given ranges. That will give us a set of candidate references
      // for each descriptor.

      const passCandidates = new Map(await Promise.all(Array.from(mustBeResolved).map(async descriptorHash => {
        const descriptor = allDescriptors.get(descriptorHash);
        if (!descriptor)
          throw new Error(`Assertion failed: The descriptor should have been registered`);

        let candidateLocators;

        try {
          candidateLocators = await resolver.getCandidates(descriptor, resolverOptions);
        } catch (error) {
          error.message = `${structUtils.prettyDescriptor(this.configuration, descriptor)}: ${error.message}`;
          throw error;
        }

        if (candidateLocators.length === 0)
          throw new Error(`No candidate found for ${structUtils.prettyDescriptor(this.configuration, descriptor)}`);

        return [descriptor.descriptorHash, candidateLocators] as [DescriptorHash, Array<Locator>];
      })));

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
        let pkg = await miscUtils.prettifyAsyncErrors(async () => {
          return await resolver.resolve(locator, resolverOptions);
        }, message => {
          return `${structUtils.prettyLocator(this.configuration, locator)}: ${message}`;
        });

        if (!structUtils.areLocatorsEqual(locator, pkg))
          throw new Error(`Assertion failed: The locator cannot be changed by the resolver (went from ${structUtils.prettyLocator(this.configuration, locator)} to ${structUtils.prettyLocator(this.configuration, pkg)})`);

        const rawDependencies = pkg.dependencies;
        const rawPeerDependencies = pkg.peerDependencies;

        const dependencies = pkg.dependencies = new Map();
        const peerDependencies = pkg.peerDependencies = new Map();

        for (const descriptor of miscUtils.sortMap(rawDependencies.values(), descriptor => structUtils.stringifyIdent(descriptor))) {
          const normalizedDescriptor = resolver.bindDescriptor(descriptor, locator, resolverOptions);
          dependencies.set(normalizedDescriptor.identHash, normalizedDescriptor);
        }

        for (const descriptor of miscUtils.sortMap(rawPeerDependencies.values(), descriptor => structUtils.stringifyIdent(descriptor)))
          peerDependencies.set(descriptor.identHash, descriptor);

        return [pkg.locatorHash, pkg] as [LocatorHash, Package];
      })));

      // Now that the resolution is finished, we can finally insert the data
      // stored inside our pass stores into the resolution ones (we now have
      // the guarantee that they'll always be inserted into in the same order,
      // since mustBeResolved is stable regardless of the order in which the
      // resolvers return)

      const haveBeenResolved = mustBeResolved;
      mustBeResolved = new Set();

      for (const descriptorHash of haveBeenResolved) {
        const locator = passResolutions.get(descriptorHash);
        if (!locator)
          throw new Error(`Assertion failed: The locator should have been registered`);

        allResolutions.set(descriptorHash, locator.locatorHash);

        const pkg = newPackages.get(locator.locatorHash);
        if (!pkg)
          continue;

        allPackages.set(pkg.locatorHash, pkg);

        for (const descriptor of pkg.dependencies.values()) {
          allDescriptors.set(descriptor.descriptorHash, descriptor);
          mustBeResolved.add(descriptor.descriptorHash);

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
          mustBeResolved.delete(descriptor.descriptorHash);
          mustBeResolved.add(aliasHash);

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

    applyVirtualResolutionMutations({
      project: this,

      volatileDescriptors,
      optionalBuilds,

      allDescriptors,
      allResolutions,
      allPackages,

      report,
    });

    // All descriptors still referenced within the volatileDescriptors set are
    // descriptors that aren't depended upon by anything in the dependency tree.

    for (const descriptorHash of volatileDescriptors) {
      allDescriptors.delete(descriptorHash);
      allResolutions.delete(descriptorHash);
    }

    // Import the dependencies for each resolved workspaces into their own
    // Workspace instance.

    for (const workspace of this.workspaces) {
      const pkg = allPackages.get(workspace.anchoredLocator.locatorHash);
      if (!pkg)
        throw new Error(`Assertion failed: Expected workspace to have been resolved`);

      workspace.dependencies = new Map(pkg.dependencies);
    }

    // Everything is done, we can now update our internal resolutions to
    // reference the new ones

    this.storedResolutions = allResolutions;
    this.storedDescriptors = allDescriptors;
    this.storedPackages = allPackages;

    this.optionalBuilds = optionalBuilds;
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

    const limit = pLimit(5);
    let firstError = false;

    await Promise.all(locatorHashes.map(locatorHash => limit(async () => {
      const pkg = this.storedPackages.get(locatorHash);
      if (!pkg)
        throw new Error(`Assertion failed: The locator should have been registered`);

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
    })));

    if (firstError) {
      throw firstError;
    }
  }

  async linkEverything({cache, report, inlineBuilds = this.configuration.get(`enableInlineBuilds`)}: InstallOptions) {
    const fetcher = this.configuration.makeFetcher();
    const fetcherOptions = {checksums: this.storedChecksums, project: this, cache, fetcher, report};

    const linkers = this.configuration.getLinkers();
    const linkerOptions = {project: this, report};

    const installers = new Map(linkers.map(linker => {
      return [linker, linker.makeInstaller(linkerOptions)] as [Linker, Installer];
    }));

    const packageLinkers: Map<LocatorHash, Linker> = new Map();
    const packageLocations: Map<LocatorHash, PortablePath> = new Map();
    const packageBuildDirectives: Map<LocatorHash, BuildDirective[]> = new Map();

    // Step 1: Installing the packages on the disk

    for (const pkg of this.storedPackages.values()) {
      const linker = linkers.find(linker => linker.supportsPackage(pkg, linkerOptions));
      if (!linker)
        throw new ReportError(MessageName.LINKER_NOT_FOUND, `${structUtils.prettyLocator(this.configuration, pkg)} isn't supported by any available linker`);

      const installer = installers.get(linker);
      if (!installer)
        throw new Error(`Assertion failed: The installer should have been registered`);

      const fetchResult = await fetcher.fetch(pkg, fetcherOptions);

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

      if (installStatus.buildDirective) {
        packageBuildDirectives.set(pkg.locatorHash, installStatus.buildDirective);
      }
    }

    // Step 2: Link packages together

    const externalDependents: Map<LocatorHash, Array<PortablePath>> = new Map();

    for (const pkg of this.storedPackages.values()) {
      const packageLinker = packageLinkers.get(pkg.locatorHash);
      if (!packageLinker)
        throw new Error(`Assertion failed: The linker should have been found`);

      const installer = installers.get(packageLinker);
      if (!installer)
        throw new Error(`Assertion failed: The installer should have been registered`);

      const packageLocation = packageLocations.get(pkg.locatorHash);
      if (!packageLocation)
        throw new Error(`Assertion failed: The package (${structUtils.prettyLocator(this.configuration, pkg)}) should have been registered`);

      const internalDependencies = [];

      for (const descriptor of pkg.dependencies.values()) {
        const resolution = this.storedResolutions.get(descriptor.descriptorHash);
        if (!resolution)
          throw new Error(`Assertion failed: The resolution (${structUtils.prettyDescriptor(this.configuration, descriptor)}) should have been registered`);

        const dependency = this.storedPackages.get(resolution);
        if (!dependency)
          throw new Error(`Assertion failed: The package (${resolution}, resolved from ${structUtils.prettyDescriptor(this.configuration, descriptor)}) should have been registered`);

        const dependencyLinker = packageLinkers.get(resolution);
        if (!dependencyLinker)
          throw new Error(`Assertion failed: The package (${resolution}, resolved from ${structUtils.prettyDescriptor(this.configuration, descriptor)}) should have been registered`);

        if (dependencyLinker === packageLinker) {
          internalDependencies.push([descriptor, dependency] as [Descriptor, Locator]);
        } else {
          let externalEntry = externalDependents.get(resolution);
          if (!externalEntry)
            externalDependents.set(resolution, externalEntry = []);

          externalEntry.push(packageLocation);
        }
      }

      await installer.attachInternalDependencies(pkg, internalDependencies);
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

    for (const installer of installers.values())
      await installer.finalizeInstall();

    // Step 4: Build the packages in multiple steps

    const readyPackages = new Set(this.storedPackages.keys());
    const buildablePackages = new Set(packageBuildDirectives.keys());

    for (const locatorHash of buildablePackages)
      readyPackages.delete(locatorHash);

    // We'll use this function is order to compute a hash for each package
    // that exposes a build directive. If the hash changes compared to the
    // previous run, the package is rebuilt. This has the advantage of making
    // the rebuilds much more predictable than before, and to give us the tools
    // later to improve this further by explaining *why* a rebuild happened.

    const getBuildHash = (locator: Locator) => {
      const hash = createHmac(`sha512`, `berry`);

      const traverse = (locatorHash: LocatorHash, seenPackages: Set<string> = new Set()) => {
        hash.update(locatorHash);

        if (!seenPackages.has(locatorHash))
          seenPackages.add(locatorHash);
        else
          return;

        const pkg = this.storedPackages.get(locatorHash);
        if (!pkg)
          throw new Error(`Assertion failed: The package should have been registered`);

        for (const dependency of pkg.dependencies.values()) {
          const resolution = this.storedResolutions.get(dependency.descriptorHash);
          if (!resolution)
            throw new Error(`Assertion failed: The resolution (${structUtils.prettyDescriptor(this.configuration, dependency)}) should have been registered`);

          traverse(resolution, new Set(seenPackages));
        }
      };

      traverse(locator.locatorHash);

      return hash.digest(`hex`);
    };

    const bstatePath: PortablePath = this.configuration.get(`bstatePath`);
    const bstate = xfs.existsSync(bstatePath)
      ? parseSyml(await xfs.readFilePromise(bstatePath, `utf8`)) as {[key: string]: string}
      : {};

    // We reconstruct the build state from an empty object because we want to
    // remove the state from packages that got removed
    const nextBState = {} as {[key: string]: string};

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

        const buildHash = getBuildHash(pkg);

        // No need to rebuild the package if its hash didn't change
        if (Object.prototype.hasOwnProperty.call(bstate, pkg.locatorHash) && bstate[pkg.locatorHash] === buildHash) {
          nextBState[pkg.locatorHash] = buildHash;
          continue;
        }

        if (Object.prototype.hasOwnProperty.call(bstate, pkg.locatorHash))
          report.reportInfo(MessageName.MUST_REBUILD, `${structUtils.prettyLocator(this.configuration, pkg)} must be rebuilt because its dependency tree changed`);
        else
          report.reportInfo(MessageName.MUST_BUILD, `${structUtils.prettyLocator(this.configuration, pkg)} must be built because it never did before or the last one failed`);

        const buildDirective = packageBuildDirectives.get(pkg.locatorHash);
        if (!buildDirective)
          throw new Error(`Assertion failed: The build directive should have been registered`);

        buildPromises.push((async () => {
          for (const [buildType, scriptName] of buildDirective) {
            const logFile = NodeFS.toPortablePath(
              tmpNameSync({
                prefix: `buildfile-`,
                postfix: `.log`,
              }),
            );

            const stdin = null;

            let stdout;
            let stderr;

            if (inlineBuilds) {
              stdout = report.createStreamReporter(`${structUtils.prettyLocator(this.configuration, pkg)} ${this.configuration.format(`STDOUT`, `green`)}`);
              stderr = report.createStreamReporter(`${structUtils.prettyLocator(this.configuration, pkg)} ${this.configuration.format(`STDERR`, `red`)}`);
            } else {
              stdout = xfs.createWriteStream(logFile);
              stderr = stdout;

              stdout.write(`# This file contains the result of Yarn building a package (${structUtils.stringifyLocator(pkg)})\n`);

              switch (buildType) {
                case BuildType.SCRIPT: {
                  stdout.write(`# Script name: ${scriptName}\n`);
                } break;
                case BuildType.SHELLCODE: {
                  stdout.write(`# Script code: ${scriptName}\n`);
                } break;
              }

              stdout.write(`\n`);
            }

            let exitCode;

            try {
              switch (buildType) {
                case BuildType.SCRIPT: {
                  exitCode = await scriptUtils.executePackageScript(pkg, scriptName, [], {project: this, stdin, stdout, stderr});
                } break;
                case BuildType.SHELLCODE: {
                  exitCode = await scriptUtils.executePackageShellcode(pkg, scriptName, [], {project: this, stdin, stdout, stderr});
                } break;
              }
            } catch (error) {
              stderr.write(error.stack);
              exitCode = 1;
            }

            if (exitCode === 0) {
              nextBState[pkg.locatorHash] = buildHash;
              continue;
            }

            const buildMessage = `${structUtils.prettyLocator(this.configuration, pkg)} couldn't be built successfully (exit code ${exitCode}, logs can be found here: ${logFile})`;

            if (!this.optionalBuilds.has(pkg.locatorHash)) {
              report.reportError(MessageName.BUILD_FAILED, buildMessage);
              break;
            }

            nextBState[pkg.locatorHash] = buildHash;
            report.reportInfo(MessageName.BUILD_FAILED, buildMessage);
          }
        })());
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

    const bstateData = Object.entries(nextBState).map(([hash, name]) => {
      const locatorHash = hash as LocatorHash;

      const pkg = this.storedPackages.get(locatorHash);
      if (!pkg)
        throw new Error(`Assertion failed: The package should have been registered`);

      return [structUtils.stringifyLocator(pkg), hash, name];
    });

    if (bstateData.length > 0) {
      let bstateFile = `# Warning: This file is automatically generated. Removing it is fine, but will\n# cause all your builds to become invalidated.\n`;

      for (const [locatorString, locatorHash, buildHash] of miscUtils.sortMap(bstateData, [d => d[0], d => d[1]])) {
        bstateFile += `\n`;
        bstateFile += `# ${locatorString}\n`;
        bstateFile += `${JSON.stringify(locatorHash)}:\n`;
        bstateFile += `  ${buildHash}\n`;
      }

      await xfs.mkdirpPromise(ppath.dirname(bstatePath));
      await xfs.changeFilePromise(bstatePath, bstateFile);
    } else {
      await xfs.removePromise(bstatePath);
    }
  }

  async install(opts: InstallOptions) {
    await opts.report.startTimerPromise(`Resolution step`, async () => {
      // If we operate with a frozen lockfile, we take a snapshot of it to later make sure it didn't change
      const initialLockfile = opts.frozenLockfile ? this.generateLockfile() : null;

      await this.resolveEverything(opts);

      if (opts.frozenLockfile && this.generateLockfile() !== initialLockfile) {
        throw new ReportError(MessageName.FROZEN_LOCKFILE_EXCEPTION, `The lockfile would have been modified by this install, which is explicitly forbidden`);
      }
    });

    await opts.report.startTimerPromise(`Fetch step`, async () => {
      await this.fetchEverything(opts);
      await this.cacheCleanup(opts);
    });

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

    optimizedLockfile[`__metadata`] = {
      version: LOCKFILE_VERSION,
    };

    for (const [locatorHash, descriptorHashes] of reverseLookup.entries()) {
      const pkg = this.storedPackages.get(locatorHash);
      if (!pkg)
        throw new Error(`Assertion failed: The package should have been registered`);

      // Virtual packages are not persisted into the lockfile: they need to be
      // recomputed at runtime through "resolveEverything". We do this (instead
      // of "forgetting" them when reading the file like for "link:" locators
      // or workspaces) because it would otherwise be super annoying to manually
      // change the resolutions from a lockfile (since you'd need to also update
      // all its virtual instances). Also it would take a bunch of useless space.
      if (structUtils.isVirtualLocator(pkg))
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

      // Since we don't keep the virtual packages in the lockfile, we must make
      // sure we don't reference them within the dependencies of our packages
      for (const [identHash, descriptor] of manifest.dependencies)
        if (structUtils.isVirtualDescriptor(descriptor))
          manifest.dependencies.set(identHash, structUtils.devirtualizeDescriptor(descriptor));

      optimizedLockfile[key] = {
        ...manifest.exportTo({}, {
          compatibilityMode: false,
        }),

        linkType: pkg.linkType,

        resolution: structUtils.stringifyLocator(pkg),
        checksum: this.storedChecksums.get(pkg.locatorHash),
      };
    }

    const header = `${[
      `# This file is generated by running "berry install" inside your project.\n`,
      `# Manual changes might be lost - proceed with caution!\n`,
    ].join(``)}\n`;

    return header + stringifySyml(optimizedLockfile);
  }

  async persistLockfile() {
    const lockfilePath = ppath.join(this.cwd, this.configuration.get(`lockfileFilename`));
    const lockfileContent = this.generateLockfile();

    await xfs.changeFilePromise(lockfilePath, lockfileContent);
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

    if (!xfs.existsSync(cache.cwd))
      return;

    if (!isFolderInside(cache.cwd, this.cwd))
      return;

    for (const entry of await xfs.readdirPromise(cache.cwd)) {
      const entryPath = ppath.resolve(cache.cwd, entry);

      if (PRESERVED_FILES.has(entry))
        continue;

      if (!cache.markedFiles.has(entryPath)) {
        report.reportInfo(MessageName.UNUSED_CACHE_ENTRY, `${ppath.basename(entryPath)} appears to be unused - removing`);

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

  optionalBuilds = new Set(),
  volatileDescriptors = new Set(),

  report,

  tolerateMissingPackages = false,
}: {
  project: Project,

  allDescriptors: Map<DescriptorHash, Descriptor>,
  allResolutions: Map<DescriptorHash, LocatorHash>,
  allPackages: Map<LocatorHash, Package>,

  optionalBuilds?: Set<LocatorHash>,
  volatileDescriptors?: Set<DescriptorHash>,

  report: Report | null,

  tolerateMissingPackages?: boolean,
}) {
  const hasBeenTraversed = new Set();
  const resolutionStack: Array<Locator> = [];

  const reportStackOverflow = (): never => {
    const logFile = NodeFS.toPortablePath(
      tmpNameSync({
        prefix: `stacktrace-`,
        postfix: `.log`,
      }),
    );

    const maxSize = String(resolutionStack.length + 1).length;
    const content = resolutionStack.map((locator, index) => {
      const prefix = `${index + 1}.`.padStart(maxSize, ` `);
      return `${prefix} ${structUtils.stringifyLocator(locator)}\n`;
    }).join(``);

    xfs.writeFileSync(logFile, content);

    throw new ReportError(MessageName.STACK_OVERFLOW_RESOLUTION, `Encountered a stack overflow when resolving peer dependencies; cf ${logFile}`);
  };

  const resolvePeerDependencies = (parentLocator: Locator, optional: boolean) => {
    resolutionStack.push(parentLocator);
    const result = resolvePeerDependenciesImpl(parentLocator, optional);
    resolutionStack.pop();

    return result;
  };

  const resolvePeerDependenciesImpl = (parentLocator: Locator, optional: boolean) => {
    if (hasBeenTraversed.has(parentLocator.locatorHash))
      return;

    hasBeenTraversed.add(parentLocator.locatorHash);

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

    const firstPass = [];
    const secondPass = [];
    const thirdPass = [];
    const fourthPass = [];

    // During this first pass we virtualize the descriptors. This allows us
    // to reference them from their sibling without being order-dependent,
    // which is required to solve cases where packages with peer dependencies
    // have peer dependencies themselves.

    for (const descriptor of Array.from(parentPackage.dependencies.values())) {
      if (parentPackage.peerDependencies.has(descriptor.identHash))
        continue;

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
        if (tolerateMissingPackages) {
          continue;
        } else {
          throw new Error(`Assertion failed: The resolution (${structUtils.prettyDescriptor(project.configuration, descriptor)}) should have been registered`);
        }
      }

      const pkg = allPackages.get(resolution);
      if (!pkg)
        throw new Error(`Assertion failed: The package (${resolution}, resolved from ${structUtils.prettyDescriptor(project.configuration, descriptor)}) should have been registered`);

      if (pkg.peerDependencies.size === 0) {
        resolvePeerDependencies(pkg, isOptional);
        continue;
      }

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
      });

      secondPass.push(() => {
        for (const peerRequest of virtualizedPackage.peerDependencies.values()) {
          let peerDescriptor = parentPackage.dependencies.get(peerRequest.identHash);

          if (!peerDescriptor && structUtils.areIdentsEqual(parentLocator, peerRequest)) {
            peerDescriptor = structUtils.convertLocatorToDescriptor(parentLocator);

            allDescriptors.set(peerDescriptor.descriptorHash, peerDescriptor);
            allResolutions.set(peerDescriptor.descriptorHash, parentLocator.locatorHash);
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

          if (peerDescriptor.range === `missing:`) {
            missingPeerDependencies.add(peerDescriptor.identHash);
          }
        }

        // Since we've had to add new dependencies we need to sort them all over again
        virtualizedPackage.dependencies = new Map(miscUtils.sortMap(virtualizedPackage.dependencies, ([identHash, descriptor]) => {
          return structUtils.stringifyIdent(descriptor);
        }));
      });

      thirdPass.push(() => {
        resolvePeerDependencies(virtualizedPackage, isOptional);
      });

      fourthPass.push(() => {
        for (const missingPeerDependency of missingPeerDependencies) {
          virtualizedPackage.dependencies.delete(missingPeerDependency);
        }
      });
    }

    const allPasses = [
      ...firstPass,
      ...secondPass,
      ...thirdPass,
      ...fourthPass,
    ];

    for (const fn of allPasses) {
      fn();
    }
  };

  try {
    for (const workspace of project.workspaces) {
      resolvePeerDependencies(workspace.anchoredLocator, false);
    }
  } catch (error) {
    if (error.name === `RangeError` && error.message === `Maximum call stack size exceeded`) {
      reportStackOverflow();
    } else {
      throw error;
    }
  }
}
