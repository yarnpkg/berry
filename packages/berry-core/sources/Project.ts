import {createHmac}                                         from 'crypto';
import {createWriteStream, existsSync, readFile, writeFile} from 'fs-extra';
// @ts-ignore
import Logic                                                from 'logic-solver';
import {dirname}                                            from 'path';
import {PassThrough}                                        from 'stream';
import {tmpNameSync}                                        from 'tmp';

import {parseSyml, stringifySyml}                           from '@berry/parsers';
import {CwdFS, FakeFS, NodeFS, ZipFS}                       from '@berry/zipfs';

import {Cache}                                              from './Cache';
import {Configuration}                                      from './Configuration';
import {Installer, BuildDirective}                          from './Installer';
import {Linker}                                             from './Linker';
import {Report, MessageName}                                from './Report';
import {WorkspaceBaseResolver}                              from './WorkspaceBaseResolver';
import {WorkspaceResolver}                                  from './WorkspaceResolver';
import {Workspace}                                          from './Workspace';
import * as miscUtils                                       from './miscUtils';
import * as structUtils                                     from './structUtils';
import {IdentHash, DescriptorHash, LocatorHash}             from './types';
import {Descriptor, Locator, Package}                       from './types';
import {LinkType}                                           from './types';
import { scriptUtils } from '.';

export type InstallOptions = {
  cache: Cache,
  report: Report,
};

export class Project {
  public readonly configuration: Configuration;
  public readonly cwd: string;

  // Is meant to be populated by the consumer. When the descriptor referenced by
  // the key should be resolved, the second one is resolved instead and its
  // result is used as final resolution for the first entry.
  public resolutionAliases: Map<DescriptorHash, DescriptorHash> = new Map();

  public workspaces: Array<Workspace> = [];

  public workspacesByCwd: Map<string, Workspace> = new Map();
  public workspacesByLocator: Map<LocatorHash, Workspace> = new Map();
  public workspacesByIdent: Map<IdentHash, Array<Workspace>> = new Map();

  public storedResolutions: Map<DescriptorHash, LocatorHash> = new Map();
  public storedLocations: Map<LocatorHash, string> = new Map();

  public storedDescriptors: Map<DescriptorHash, Descriptor> = new Map();
  public storedPackages: Map<LocatorHash, Package> = new Map();

  static async find(configuration: Configuration, startingCwd: string) {
    let projectCwd = null;
    let workspaceCwd = null;

    let nextCwd = startingCwd;
    let currentCwd = null;

    while (nextCwd !== currentCwd) {
      currentCwd = nextCwd;
      if (existsSync(`${currentCwd}/package.json`)) {
        projectCwd = currentCwd;
        if (!workspaceCwd) {
          workspaceCwd = currentCwd;
        }
      }
      nextCwd = dirname(currentCwd);
    }

    if (!projectCwd || !workspaceCwd)
      throw new Error(`Project not found`);

    const project = new Project(projectCwd, {configuration});

    await project.setupResolutions();
    await project.setupWorkspaces();

    const workspace = project.getWorkspaceByCwd(workspaceCwd);

    return {project, workspace};
  }

  constructor(projectCwd: string, {configuration}: {configuration: Configuration}) {
    this.configuration = configuration;
    this.cwd = projectCwd;
  }

  private async setupResolutions() {
    this.storedResolutions = new Map();

    this.storedDescriptors = new Map();
    this.storedPackages = new Map();

    const lockfilePath = `${this.cwd}/${this.configuration.lockfileName}`;

    if (existsSync(lockfilePath)) {
      const content = await readFile(lockfilePath, `utf8`);
      const parsed: any = parseSyml(content);

      for (const key of Object.keys(parsed)) {
        if (key === `__metadata`)
          continue;

        const data = parsed[key];
        const locator = structUtils.parseLocator(data.resolution);

        const languageName = data.languageName || `node`;
        const linkType = data.linkType as LinkType || LinkType.HARD;

        const dependencies = new Map<IdentHash, Descriptor>();
        const peerDependencies = new Map<IdentHash, Descriptor>();

        for (const dependency of Object.keys(data.dependencies || {})) {
          const descriptor = structUtils.makeDescriptor(structUtils.parseIdent(dependency), data.dependencies[dependency]);
          dependencies.set(descriptor.identHash, descriptor);
        }

        for (const dependency of Object.keys(data.peerDependencies || {})) {
          const descriptor = structUtils.makeDescriptor(structUtils.parseIdent(dependency), data.peerDependencies[dependency]);
          peerDependencies.set(descriptor.identHash, descriptor);
        }

        const pkg: Package = {...locator, languageName, linkType, dependencies, peerDependencies};
        this.storedPackages.set(pkg.locatorHash, pkg);

        for (const entry of key.split(/ *, */g)) {
          const descriptor = structUtils.parseDescriptor(entry);
          this.storedDescriptors.set(descriptor.descriptorHash, descriptor);
          this.storedResolutions.set(descriptor.descriptorHash, pkg.locatorHash);
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

        for (const workspaceCwd of workspace.workspacesCwds) {
          workspaceCwds.push(workspaceCwd);
        }
      }
    }
  }

  async addWorkspace(workspaceCwd: string) {
    const workspace = new Workspace(workspaceCwd, {project: this});
    await workspace.setup();

    if (this.workspacesByLocator.has(workspace.locator.locatorHash))
      throw new Error(`Duplicate workspace`);

    this.workspaces.push(workspace);

    this.workspacesByCwd.set(workspaceCwd, workspace);
    this.workspacesByLocator.set(workspace.locator.locatorHash, workspace);

    let byIdent = this.workspacesByIdent.get(workspace.locator.identHash);
    if (!byIdent)
      this.workspacesByIdent.set(workspace.locator.identHash, byIdent = []);
    byIdent.push(workspace);

    return workspace;
  }

  get topLevelWorkspace() {
    return this.getWorkspaceByCwd(this.cwd);
  }

  tryWorkspaceByCwd(workspaceCwd: string) {
    const workspace = this.workspacesByCwd.get(workspaceCwd);

    return workspace ? workspace : null;
  }

  getWorkspaceByCwd(workspaceCwd: string) {
    const workspace = this.tryWorkspaceByCwd(workspaceCwd);
    if (!workspace)
      throw new Error(`Workspace not found (${workspaceCwd})`);

    return workspace;
  }

  tryWorkspaceByLocator(locator: Locator) {
    if (locator.reference.startsWith(WorkspaceBaseResolver.protocol))
      locator = structUtils.makeLocator(locator, locator.reference.slice(WorkspaceBaseResolver.protocol.length));
    else if (locator.reference.startsWith(WorkspaceResolver.protocol))
      locator = structUtils.makeLocator(locator, locator.reference.slice(WorkspaceResolver.protocol.length));

    const workspace = this.workspacesByLocator.get(locator.locatorHash);

    return workspace ? workspace : null;
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
    const resolver = this.configuration.makeResolver({
      useLockfile: false,
    });

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

  async resolveEverything({cache, report}: InstallOptions) {
    if (!this.workspacesByCwd || !this.workspacesByIdent)
      throw new Error(`Workspaces must have been setup before calling this function`);

    // Note that the resolution process is "offline" until everything has been
    // successfully resolved; all the processing is expected to have zero side
    // effects until we're ready to set all the variables at once (the one
    // exception being when a resolver needs to fetch a package, in which case
    // we might need to populate the cache).

    // This makes it possible to use the same Project instance for multiple
    // purposes at the same time (since `resolveEverything` is async, it might
    // happen that we want to do something while waiting for it to end; if we
    // were to mutate the project then it would end up in a partial state that
    // could lead to hard-to-debug issues).

    const resolver = this.configuration.makeResolver();
    const fetcher = this.configuration.makeFetcher();

    const resolverOptions = {project: this, readOnly: false, rootFs: new NodeFS(), resolver, fetcher, cache};

    const allDescriptors = new Map<DescriptorHash, Descriptor>();
    const allPackages = new Map<LocatorHash, Package>();
    const allResolutions = new Map<DescriptorHash, LocatorHash>();

    const haveBeenAliased = new Set<DescriptorHash>();

    let mustBeResolved = new Set<DescriptorHash>();

    for (const workspace of this.workspacesByLocator.values()) {
      const workspaceDescriptor = workspace.anchoredDescriptor;

      allDescriptors.set(workspaceDescriptor.descriptorHash, workspaceDescriptor);
      mustBeResolved.add(workspaceDescriptor.descriptorHash);
    }

    while (mustBeResolved.size !== 0) {
      // First, we replace all packages to be resolved by their aliases

      for (const descriptorHash of mustBeResolved) {
        const aliasHash = this.resolutionAliases.get(descriptorHash);
        if (aliasHash === undefined)
          continue;

        // It doesn't cost us much to support the case where a descriptor is
        // equal to its own alias (which should mean "no alias")
        if (descriptorHash === aliasHash)
          continue;

        const alias = this.storedDescriptors.get(aliasHash);
        if (!alias)
          throw new Error(`Assertion failed: The alias should have been registered`);

        // If it's already been "resolved" (in reality it will be the temporary
        // resolution we've set in the next few lines) we can just skip it
        if (allResolutions.has(descriptorHash))
          continue;

        // Temporarily set an invalid resolution; we will replace it by the
        // actual one after we've finished resolving the aliases
        allResolutions.set(descriptorHash, `temporary` as LocatorHash);

        // We can now replace the descriptor by its alias (once everything will
        // have been resolved, we'll do a pass to copy the aliases resolutions
        // into their respective sources)
        mustBeResolved.delete(descriptorHash);
        mustBeResolved.add(aliasHash);

        allDescriptors.set(aliasHash, alias);

        haveBeenAliased.add(descriptorHash);
      }

      // Then we remove from the "mustBeResolved" list all packages that have
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

        let candidateReferences;

        try {
          candidateReferences = await resolver.getCandidates(descriptor, resolverOptions);
        } catch (error) {
          error.message = `${structUtils.prettyDescriptor(this.configuration, descriptor)}: ${error.message}`;
          throw error;
        }

        if (candidateReferences.length === 0)
          throw new Error(`No candidate found for ${structUtils.prettyDescriptor(this.configuration, descriptor)}`);

        // Reversing it make the following algorithms prioritize the more recent releases
        candidateReferences.reverse();

        const candidateLocators = candidateReferences.map(reference => {
          return structUtils.makeLocator(descriptor, reference);
        });

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
          solver.require(Logic.or(... candidateLocators.map(locator => locator.locatorHash)));

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
      // hasn't been seen before, we fetch its dependency list and schedule it
      // for the next cycle.

      const newLocators = new Map<LocatorHash, Locator>();

      for (const locator of passResolutions.values()) {
        if (allPackages.has(locator.locatorHash))
          continue;

        newLocators.set(locator.locatorHash, locator);
      }

      const newPackages = new Map(await Promise.all(Array.from(newLocators.values()).map(async locator => {
        let pkg;

        try {
          pkg = await resolver.resolve(locator, resolverOptions);
        } catch (error) {
          error.message = `${structUtils.prettyLocator(this.configuration, locator)}: ${error.message}`;
          throw error;
        }

        if (!structUtils.areLocatorsEqual(locator, pkg))
          throw new Error(`Assertion failed: The locator cannot be changed by the resolver (went from ${structUtils.prettyLocator(this.configuration, locator)} to ${structUtils.prettyLocator(this.configuration, pkg)})`);

        const rawDependencies = pkg.dependencies;
        const rawPeerDependencies = pkg.peerDependencies;

        const dependencies = pkg.dependencies = new Map();
        const peerDependencies = pkg.peerDependencies = new Map();

        for (const [source, target] of [[rawDependencies, dependencies], [rawPeerDependencies, peerDependencies]]) {
          for (const descriptor of source.values()) {
            const normalizedDescriptor = await resolver.normalizeDescriptor(descriptor, locator, resolverOptions);
            target.set(normalizedDescriptor.identHash, normalizedDescriptor);
          }
        }

        return [pkg.locatorHash, pkg] as [LocatorHash, Package];
      })));

      // Now that the resolution is finished, we can finally insert the content
      // from our temporary stores into the global ones, by making sure to do
      // it in a predictable order.

      const stableOrder = mustBeResolved;
      mustBeResolved = new Set();

      for (const descriptorHash of stableOrder) {
        const locator = passResolutions.get(descriptorHash);
        if (!locator)
          throw new Error(`Assertion failed: The locator should have been registered`);

        allResolutions.set(descriptorHash, locator.locatorHash);

        const pkg = newPackages.get(locator.locatorHash);

        if (pkg) {
          allPackages.set(pkg.locatorHash, pkg);

          // The resolvers are not expected to return the dependencies in any
          // particular order, so we must be careful and sort them ourselves in
          // order to have 100% reproductible builds
          const sortedDependencies = miscUtils.sortMap(pkg.dependencies.values(), [descriptor => {
            return structUtils.stringifyDescriptor(descriptor);
          }]);

          for (const descriptor of sortedDependencies) {
            allDescriptors.set(descriptor.descriptorHash, descriptor);
            mustBeResolved.add(descriptor.descriptorHash);
          }
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

    const hasBeenTraversed = new Set();
    const volatileDescriptors = new Set(this.resolutionAliases.values());

    const resolvePeerDependencies = (parentLocator: Locator) => {
      if (hasBeenTraversed.has(parentLocator.locatorHash))
        return;

      hasBeenTraversed.add(parentLocator.locatorHash);

      const parentPackage = allPackages.get(parentLocator.locatorHash);
      if (!parentPackage)
        throw new Error(`Assertion failed: The package (${structUtils.prettyLocator(this.configuration, parentLocator)}) should have been registered`);

      for (const descriptor of Array.from(parentPackage.dependencies.values())) {
        volatileDescriptors.delete(descriptor.descriptorHash);

        if (descriptor.range === `missing:`)
          continue;

        const resolution = allResolutions.get(descriptor.descriptorHash);
        if (!resolution)
          throw new Error(`Assertion failed: The resolution (${structUtils.prettyDescriptor(this.configuration, descriptor)}) should have been registered`);

        let pkg = allPackages.get(resolution);
        if (!pkg)
          throw new Error(`Assertion failed: The package (${resolution}, resolved from ${structUtils.prettyDescriptor(this.configuration, descriptor)}) should have been registered`);

        if (pkg.peerDependencies.size > 0) {
          const virtualizedDescriptor = structUtils.virtualizeDescriptor(descriptor, parentLocator.locatorHash);
          const virtualizedPackage = structUtils.virtualizePackage(pkg, parentLocator.locatorHash);

          parentPackage.dependencies.delete(descriptor.identHash);
          parentPackage.dependencies.set(virtualizedDescriptor.identHash, virtualizedDescriptor);

          allResolutions.set(virtualizedDescriptor.descriptorHash, virtualizedPackage.locatorHash);
          allDescriptors.set(virtualizedDescriptor.descriptorHash, virtualizedDescriptor);

          allPackages.set(virtualizedPackage.locatorHash, virtualizedPackage);

          const missingPeerDependencies = new Set();

          for (const peerRequest of virtualizedPackage.peerDependencies.values()) {
            let peerDescriptor = parentPackage.dependencies.get(peerRequest.identHash);

            if (!peerDescriptor && structUtils.areIdentsEqual(parentLocator, peerRequest)) {
              peerDescriptor = structUtils.convertLocatorToDescriptor(parentLocator);

              allDescriptors.set(peerDescriptor.descriptorHash, peerDescriptor);
              allResolutions.set(peerDescriptor.descriptorHash, parentLocator.locatorHash);
            }

            const isOptional = peerRequest.range.startsWith(`optional:`);

            if (!peerDescriptor) {
              if (!isOptional)
                report.reportWarning(MessageName.MISSING_PEER_DEPENDENCY, `${structUtils.prettyLocator(this.configuration, parentLocator)} doesn't provide ${structUtils.prettyDescriptor(this.configuration, peerRequest)} requested by ${structUtils.prettyLocator(this.configuration, pkg)}`);

              peerDescriptor = structUtils.makeDescriptor(peerRequest, `missing:`);
            }

            if (peerDescriptor.range === `missing:`) {
              missingPeerDependencies.add(peerDescriptor.descriptorHash);
            } else {
              virtualizedPackage.dependencies.set(peerDescriptor.identHash, peerDescriptor);
            }
          }

          resolvePeerDependencies(virtualizedPackage);

          for (const missingPeerDependency of missingPeerDependencies) {
            virtualizedPackage.dependencies.delete(missingPeerDependency);
          }
        } else {
          resolvePeerDependencies(pkg);
        }
      }
    };

    for (const workspace of this.workspacesByLocator.values())
      resolvePeerDependencies(workspace.anchoredLocator);

    // All descriptors still referenced within the volatileDescriptors set are
    // descriptors that aren't depended upon by anything in the dependency tree.

    for (const descriptorHash of volatileDescriptors) {
      allDescriptors.delete(descriptorHash);
      allResolutions.delete(descriptorHash);
    }

    // Import the dependencies for each resolved workspaces into their own
    // Workspace instance.

    for (const workspace of this.workspacesByLocator.values()) {
      const pkg = allPackages.get(workspace.anchoredLocator.locatorHash);
      if (!pkg)
        throw new Error(`Assertion failed: Expected workspace to have been resolved`);

      if (pkg.peerDependencies.size > 0)
        throw new Error(`Assertion failed: Didn't expect root workspaces to have peer dependencies`);

      workspace.dependencies = pkg.dependencies;
    }

    // Everything is done, we can now update our internal resolutions to
    // reference the new ones

    this.storedResolutions = allResolutions;
    this.storedDescriptors = allDescriptors;
    this.storedPackages = allPackages;
  }

  async fetchEverything({cache}: InstallOptions) {
    this.storedLocations = new Map();

    const fetcher = this.configuration.makeFetcher();
    const fetcherOptions = {project: this, readOnly: false, rootFs: new NodeFS(), cache, fetcher};

    for (const locatorHash of this.storedResolutions.values()) {
      const pkg = this.storedPackages.get(locatorHash);
      if (!pkg)
        throw new Error(`Assertion failed: The locator should have been registered`);

      if (this.storedLocations.has(pkg.locatorHash))
        continue;

      const workspace = this.tryWorkspaceByLocator(pkg);

      if (workspace) {
        this.storedLocations.set(pkg.locatorHash, workspace.cwd);
      } else {
        const [packageFs, release] = await fetcher.fetch(pkg, fetcherOptions);
        this.storedLocations.set(pkg.locatorHash, packageFs.getRealPath());
        await release();
      }
    }
  }

  async linkEverything({cache, report}: InstallOptions) {
    const rootFs = new NodeFS();

    const fetcher = this.configuration.makeFetcher();
    const fetcherOptions = {project: this, readOnly: true, cache, fetcher, rootFs};

    const linkers = this.configuration.getLinkers();
    const linkerOptions = {project: this, report};

    const installers = new Map(linkers.map(linker => {
      return [linker, linker.makeInstaller(linkerOptions)] as [Linker, Installer];
    }));

    const packageLinkers: Map<LocatorHash, Linker> = new Map();
    const packageLocations: Map<LocatorHash, string> = new Map();
    const packageBuildDirectives: Map<LocatorHash, BuildDirective> = new Map();

    // Step 1: Installing the packages on the disk

    for (const pkg of this.storedPackages.values()) {
      const linker = linkers.find(linker => linker.supports(pkg, linkerOptions));
      if (!linker)
        throw new Error(`The package ${structUtils.prettyLocator(this.configuration, pkg)} isn't supported by any of the available linkers`);

      const installer = installers.get(linker);
      if (!installer)
        throw new Error(`Assertion failed: The installer should have been registered`);
      
      const [packageFs, release] = await fetcher.fetch(pkg, fetcherOptions);

      let installStatus;
      try {
        installStatus = await installer.installPackage(pkg, pkg.linkType, packageFs);
      } finally {
        await release();
      }

      packageLinkers.set(pkg.locatorHash, linker);
      packageLocations.set(pkg.locatorHash, installStatus.packageLocation);

      if (installStatus.buildDirective) {
        packageBuildDirectives.set(pkg.locatorHash, installStatus.buildDirective);
      }
    }

    // Step 2: Link packages together

    const externalDependents: Map<LocatorHash, Array<string>> = new Map();

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
          internalDependencies.push(dependency);
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

        if (!seenPackages.has(locatorHash)) {
          seenPackages.add(locatorHash);
        } else {
          return;
        }

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

    const bstate = existsSync(this.configuration.bstatePath)
      ? parseSyml(await readFile(this.configuration.bstatePath, `utf8`)) as {[key: string]: string}
      : {};

    while (buildablePackages.size > 0) {
      const savedSize = buildablePackages.size;

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
        if (Object.prototype.hasOwnProperty.call(bstate, pkg.locatorHash) && bstate[pkg.locatorHash] === buildHash)
          continue;

        if (Object.prototype.hasOwnProperty.call(bstate, pkg.locatorHash))
          report.reportInfo(MessageName.MUST_REBUILD, `${structUtils.prettyLocator(this.configuration, pkg)} must be rebuilt because its dependency tree changed`);
        else
          report.reportInfo(MessageName.MUST_BUILD, `${structUtils.prettyLocator(this.configuration, pkg)} must be built because it never did before or the last one failed`);
        
        const buildDirective = packageBuildDirectives.get(pkg.locatorHash);
        if (!buildDirective)
          throw new Error(`Assertion failed: The build directive should have been registered`);

        for (const scriptName of buildDirective.scriptNames) {
          const stdin = new PassThrough();
          stdin.end();

          const logFile = tmpNameSync({
            prefix: `buildfile-`,
            postfix: `.log`,
          });

          const stdout = createWriteStream(logFile);
          const stderr = stdout;

          stdout.write(`# This file contains the result of Berry building a package (${structUtils.stringifyLocator(pkg)})\n`);
          stdout.write(`\n`);

          try {
            await scriptUtils.executePackageScript(pkg, scriptName, [], {project: this, stdin, stdout, stderr});
            bstate[pkg.locatorHash] = buildHash;
          } catch (error) {
            report.reportError(MessageName.BUILD_FAILED, `${structUtils.prettyLocator(this.configuration, pkg)} couldn't be built successfully (logs can be found here: ${logFile})`);
            delete bstate[pkg.locatorHash];
          }
        }
      }

      await writeFile(this.configuration.bstatePath, stringifySyml(bstate));

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
  }

  async install(opts: InstallOptions) {
    // Ensures that we notice it when dependencies are added / removed from all sources coming from the filesystem
    await this.forgetTransientResolutions();

    await opts.report.startTimerPromise(`Resolution step`, async () => {
      await this.resolveEverything(opts);
    });

    await opts.report.startTimerPromise(`Fetch step`, async () => {
      await this.fetchEverything(opts);
    });

    await opts.report.startTimerPromise(`Link step`, async () => {
      await this.linkEverything(opts);
    });
  }

  async persistLockfile() {
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
      version: 1,
    };

    for (const [locatorHash, descriptorHashes] of reverseLookup.entries()) {
      const pkg = this.storedPackages.get(locatorHash);
      if (!pkg)
        throw new Error(`Assertion failed: The package should have been registered`);

      // Virtual packages are not persisted into the lockfile: they need to be
      // recomputed at runtime through "resolveEverything".
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

      const dependencies: {[key: string]: string} = {};
      const peerDependencies: {[key: string]: string} = {};

      for (const dependency of pkg.dependencies.values()) {
        if (!structUtils.isVirtualDescriptor(dependency)) {
          dependencies[structUtils.stringifyIdent(dependency)] = dependency.range;
        } else {
          const devirtualizedDependency = structUtils.devirtualizeDescriptor(dependency);
          dependencies[structUtils.stringifyIdent(devirtualizedDependency)] = devirtualizedDependency.range;
        }
      }

      for (const dependency of pkg.peerDependencies.values())
        peerDependencies[structUtils.stringifyIdent(dependency)] = dependency.range;

      const rest = (pkg => {
        // Remove the fields we're not interested in to only keep the ones we want
        const {identHash, scope, name, locatorHash, reference, dependencies, peerDependencies, ... rest} = pkg;
        return rest;
      })(pkg);

      optimizedLockfile[key] = {
        ... rest,
        resolution: structUtils.stringifyLocator(pkg),
        dependencies: Object.keys(dependencies).length > 0 ? dependencies : undefined,
        peerDependencies: Object.keys(peerDependencies).length > 0 ? peerDependencies : undefined,
      };
    }

    const header = [
      `# This file is generated by running "berry install" inside your project.\n`,
      `# Manual changes might be lost - proceed with caution!\n`
    ].join(``) + `\n`;

    const lockfilePath = `${this.cwd}/${this.configuration.lockfileName}`;
    const content = header + stringifySyml(optimizedLockfile);

    const currentContent = existsSync(lockfilePath)
      ? await readFile(lockfilePath, `utf8`)
      : null;

    if (currentContent !== content) {
      await writeFile(lockfilePath, content);
    }
  }

  async persist() {
    await this.persistLockfile();

    for (const workspace of this.workspacesByCwd.values()) {
      await workspace.persistManifest();
    }
  }
}
