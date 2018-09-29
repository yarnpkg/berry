// @ts-ignore
import Logic = require('logic-solver');

import {existsSync, readFile, writeFile}                      from 'fs';
import {dirname}                                              from 'path';
import {promisify}                                            from 'util';

import {parseSyml, stringifySyml}                             from '@berry/parsers';
import {extractPnpSettings, generatePnpScript}                from '@berry/pnp';

import {CacheFetcher}                                         from './CacheFetcher';
import {Cache}                                                from './Cache';
import {Configuration}                                        from './Configuration';
import {LockfileResolver}                                     from './LockfileResolver';
import {MultiFetcher}                                         from './MultiFetcher';
import {MultiResolver}                                        from './MultiResolver';
import {Resolver}                                             from './Resolver';
import {VirtualFetcher}                                       from './VirtualFetcher';
import {WorkspaceBaseFetcher}                                 from './WorkspaceBaseFetcher';
import {WorkspaceBaseResolver}                                from './WorkspaceBaseResolver';
import {WorkspaceFetcher}                                     from './WorkspaceFetcher';
import {WorkspaceResolver}                                    from './WorkspaceResolver';
import {Workspace}                                            from './Workspace';
import * as structUtils                                       from './structUtils';
import {Ident, Descriptor, Locator, Package}                  from './types';

const readFileP = promisify(readFile);
const writeFileP = promisify(writeFile);

export class Project {
  public readonly configuration: Configuration;
  public readonly cwd: string;

  public workspacesByCwd: Map<string, Workspace> = new Map();
  public workspacesByLocator: Map<string, Workspace> = new Map();
  public workspacesByIdent: Map<string, Array<Workspace>> = new Map();

  public storedResolutions: Map<string, string> = new Map();
  public storedLocations: Map<string, string> = new Map();

  public storedDescriptors: Map<string, Descriptor> = new Map();
  public storedPackages: Map<string, Package> = new Map();

  public errors: Array<Error> = [];

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

    if (existsSync(`${this.cwd}/berry.lock`)) {
      const content = await readFileP(`${this.cwd}/berry.lock`, `utf8`);
      const parsed: any = parseSyml(content);

      for (const key of Object.keys(parsed)) {
        const data = parsed[key];
        const locator = structUtils.parseLocator(data.resolution);

        const dependencies = new Map<string, Descriptor>();
        const peerDependencies = new Map<string, Descriptor>();

        for (const dependency of Object.keys(data.dependencies || {})) {
          const descriptor = structUtils.makeDescriptor(structUtils.parseIdent(dependency), data.dependencies[dependency]);
          dependencies.set(descriptor.descriptorHash, descriptor);
        }

        for (const dependency of Object.keys(data.peerDependencies || {})) {
          const descriptor = structUtils.makeDescriptor(structUtils.parseIdent(dependency), data.peerDependencies[dependency]);
          peerDependencies.set(descriptor.descriptorHash, descriptor);
        }

        const pkg: Package = {...locator, dependencies, peerDependencies};
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

        for (const workspaceCwd of await workspace.resolveChildWorkspaces()) {
          workspaceCwds.push(workspaceCwd);
        }
      }
    }
  }

  async addWorkspace(workspaceCwd: string) {
    if (!this.workspacesByCwd || !this.workspacesByLocator)
      throw new Error(`Workspaces must have been setup before calling this function`);

    const workspace = new Workspace(workspaceCwd, {project: this});
    await workspace.setup();

    if (this.workspacesByLocator.has(workspace.locator.locatorHash))
      throw new Error(`Duplicate workspace`);

    this.workspacesByCwd.set(workspaceCwd, workspace);
    this.workspacesByLocator.set(workspace.locator.locatorHash, workspace);

    let byIdent = this.workspacesByIdent.get(workspace.locator.identHash);
    if (!byIdent)
      this.workspacesByIdent.set(workspace.locator.identHash, byIdent = []);
    byIdent.push(workspace);

    return workspace;
  }

  tryWorkspaceByCwd(workspaceCwd: string) {
    const workspace = this.workspacesByCwd.get(workspaceCwd);

    if (!workspace)
      return null;

    return workspace;
  }

  getWorkspaceByCwd(workspaceCwd: string) {
    const workspace = this.workspacesByCwd.get(workspaceCwd);

    if (!workspace)
      throw new Error(`Workspace not found (${workspaceCwd})`);

    return workspace;
  }

  tryWorkspaceByLocator(locator: Locator) {
    const workspace = this.workspacesByLocator.get(locator.locatorHash);

    if (!workspace)
      return null;

    return workspace;
  }

  getWorkspaceByLocator(locator: Locator) {
    const workspace = this.workspacesByLocator.get(locator.locatorHash);

    if (!workspace)
      throw new Error(`Workspace not found`);

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

  async getPackageLocation(locator: Locator, {cache = null}: {cache?: Cache | null} = {}) {
    const workspace = this.tryWorkspaceByLocator(locator);

    if (workspace) {
      return workspace.cwd;
    } else if (!cache) {
      throw new Error(`The manifest for "${structUtils.prettyLocator(locator)}" cannot be located without a cache`);
    }

    const {file} = await cache.fetchFromCache(locator);
    return file;
  }

  async getPackageManifest(locator: Locator, {cache = null}: {cache?: Cache | null} = {}) {
    const workspace = this.tryWorkspaceByLocator(locator);

    if (workspace) {
      return workspace.manifest;
    } else if (!cache) {
      throw new Error(`The manifest for "${structUtils.prettyLocator(locator)}" cannot be located without a cache`);
    }

    const {entity: archive} = await cache.fetchFromCache(locator);
    const manifest = await archive.getPackageManifest();

    return manifest;
  }

  async resolveEverything() {
    if (!this.workspacesByCwd || !this.workspacesByIdent)
      throw new Error(`Workspaces must have been setup before calling this function`);

    const pluginResolvers = [];

    for (const plugin of this.configuration.plugins.values())
      for (const resolver of plugin.resolvers || [])
        pluginResolvers.push(resolver);

    const resolver = new MultiResolver([
      new WorkspaceBaseResolver(),
      new WorkspaceResolver(),
      new LockfileResolver(),

      ... pluginResolvers,
    ]);

    const allDescriptors = new Map<string, Descriptor>();
    const allLocators = new Map<string, Locator>();
    const allPackages = new Map<string, Package>(this.storedPackages);

    const resolvedDescriptors = new Map<string, string>();
    const resolvedLocators = new Set<string>();

    let mustBeResolved = new Set<string>();

    for (const workspace of this.workspacesByLocator.values()) {
      const workspaceDescriptor = workspace.anchoredDescriptor;

      allDescriptors.set(workspaceDescriptor.descriptorHash, workspaceDescriptor);
      mustBeResolved.add(workspaceDescriptor.descriptorHash);
    }

    while (mustBeResolved.size !== 0) {
      const allCandidates = new Map<string, Array<string>>();
      const newLocators = new Set<string>();

      // During this second step, we try to figure out which package can satisfy the dependencies
      // that aren't already satisfied. If they can be satisfied by exactly one reference, or if
      // we've already planned to use a reference that could satisfy them, then we select it. But
      // if we end up with multiple possible candidates, then we delegate the decision to a SAT
      // solver in the second step.

      await Promise.all([ ... mustBeResolved ].map(async descriptorHash => {
        const descriptor = allDescriptors.get(descriptorHash);

        if (!descriptor)
          throw new Error(`The descriptor should have been registered`);

        if (resolvedDescriptors.has(descriptor.descriptorHash))
          return;

        let candidateReferences;

        try {
          candidateReferences = await resolver.getCandidates(descriptor, {project: this});
        } catch (error) {
          error.message = `${structUtils.prettyDescriptor(descriptor)}: ${error.message}`;
          throw error;
        }

        // Reversing it make the following algorithm prioritize the more recent releases
        candidateReferences.reverse();

        if (candidateReferences.length === 0)
          throw new Error(`No candidate found for ${structUtils.prettyDescriptor(descriptor)}`);

        if (candidateReferences.length === 1) {
          const locator = structUtils.makeLocatorFromDescriptor(descriptor, candidateReferences[0]);

          allLocators.set(locator.locatorHash, locator);
          resolvedDescriptors.set(descriptor.descriptorHash, locator.locatorHash);

          if (!resolvedLocators.has(locator.locatorHash)) {
            resolvedLocators.add(locator.locatorHash);
            newLocators.add(locator.locatorHash);
          }
        } else {
          const locatorHashes = [];

          for (const reference of candidateReferences) {
            const locator = structUtils.makeLocatorFromDescriptor(descriptor, reference);

            allLocators.set(locator.locatorHash, locator);
            locatorHashes.push(locator.locatorHash);
          }

          allCandidates.set(descriptor.descriptorHash, locatorHashes);
        }
      }));

      // This is a mini-step where we simply iterate over the candidates, and see whether we've
      // already selected one of them for a different descriptor. If it's the case, then we
      // simply reuse it and remove the current descriptor from the undecided list.

      for (const [descriptorHash, locatorHashes] of allCandidates.entries()) {
        const selectedHash = locatorHashes.find(locatorHash => allPackages.has(locatorHash));

        if (!selectedHash)
          continue;

        resolvedDescriptors.set(descriptorHash, selectedHash);
        allCandidates.delete(descriptorHash);

        if (!resolvedLocators.has(selectedHash)) {
          resolvedLocators.add(selectedHash);
          newLocators.add(selectedHash);
        }
      }

      mustBeResolved = new Set<string>();

      // All entries that remain in allCandidates are from descriptors that we haven't beem able
      // to resolve in the first place. We'll now configure our SAT solver so that it can figure
      // it out for us. To do this, we simply add a constraint for each descriptor that lists all
      // the descriptors it would accept. We don't have to care about the locators that have
      // already been selected, because if there was any they would have been selected in the
      // previous step (we never backtrace to try to find better solutions, it would be a too
      // expensive process - we just want to get an acceptable solution, not the very best one).

      if (allCandidates.size > 0) {
        const solver = new Logic.Solver();

        for (const [descriptorHash, locatorHashes] of allCandidates.entries())
          solver.require(Logic.or(... locatorHashes));

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
          throw new Error(`Error during the resolution process - this theoretically cannot happen`);

        const solutionSet = new Set<string>(bestSolution);

        for (const [descriptorHash, locatorHashes] of allCandidates.entries()) {
          const solutionHash = locatorHashes.find(locatorHash => solutionSet.has(locatorHash));

          if (!solutionHash)
            throw new Error(`The descriptor should have been solved during the previous step`);

          resolvedDescriptors.set(descriptorHash, solutionHash);
        }

        // As mentioned previously, all the locators of the solution set are guaranteed never to
        // have been registered before (since otherwise they would have been picked without going
        // through the SAT solver)
        for (const locatorHash of solutionSet) {
          resolvedLocators.add(locatorHash);
          newLocators.add(locatorHash);
        }
      }

      // And finally, the last step is to iterate over all the new locators that have been selected
      // as resolution of a descriptor, and to fetch their own dependencies so that we can resolve
      // them as well.

      await Promise.all([...newLocators].map(async locatorHash => {
        const locator = allLocators.get(locatorHash);

        if (!locator)
          throw new Error(`The locator should have been registered`);

        let pkg = allPackages.get(locator.locatorHash);

        if (!pkg) {
          try {
            pkg = await resolver.resolve(locator, {project: this});
          } catch (error) {
            error.message = `${structUtils.prettyLocator(locator)}: ${error.message}`;
            throw error;
          }
        }

        if (!structUtils.areLocatorsEqual(locator, pkg))
          throw new Error(`The locator cannot be changed by the resolver (went from ${structUtils.prettyLocator(locator)} to ${structUtils.prettyLocator(pkg)})`);

        allPackages.set(pkg.locatorHash, pkg);

        for (const descriptor of pkg.dependencies.values()) {
          if (!resolvedDescriptors.has(descriptor.descriptorHash)) {
            allDescriptors.set(descriptor.descriptorHash, descriptor);
            mustBeResolved.add(descriptor.descriptorHash);
          }
        }
      }));
    }

    //
    const hasBeenTraversed = new Set();

    const resolvePeerDependencies = (parentLocator: Locator) => {
      if (hasBeenTraversed.has(parentLocator))
        return;

      hasBeenTraversed.add(parentLocator);

      const parentPackage = allPackages.get(parentLocator.locatorHash);

      if (!parentPackage)
        throw new Error(`The package (${structUtils.prettyLocator(parentLocator)}) should have been registered`);

      for (const descriptor of Array.from(parentPackage.dependencies.values())) {
        const resolution = resolvedDescriptors.get(descriptor.descriptorHash);

        if (!resolution)
          throw new Error(`The resolution (${structUtils.prettyDescriptor(descriptor)}) should have been registered`);

        let pkg = allPackages.get(resolution);

        if (!pkg)
          throw new Error(`The package (${resolution}, resolved from ${structUtils.prettyDescriptor(descriptor)}) should have been registered`);

        if (pkg.peerDependencies.size > 0) {
          pkg = structUtils.virtualizePackage(pkg, parentLocator.locatorHash);

          const pkgLocator = structUtils.convertPackageToLocator(pkg);
          const pkgDescriptor = structUtils.convertLocatorToDescriptor(pkgLocator);

          parentPackage.dependencies.delete(descriptor.descriptorHash);
          parentPackage.dependencies.set(pkgDescriptor.descriptorHash, pkgDescriptor);

          resolvedDescriptors.set(pkgDescriptor.descriptorHash, pkgLocator.locatorHash);

          allDescriptors.set(pkgDescriptor.descriptorHash, pkgDescriptor);
          allPackages.set(pkg.locatorHash, pkg);

          for (const peerRequest of pkg.peerDependencies.values()) {
            let peerDescriptor = Array.from(parentPackage.dependencies.values()).find(descriptor => {
              return structUtils.areIdentsEqual(descriptor, peerRequest);
            });

            if (!peerDescriptor && structUtils.areIdentsEqual(parentLocator, peerRequest)) {
              peerDescriptor = structUtils.convertLocatorToDescriptor(parentLocator);

              allDescriptors.set(peerDescriptor.descriptorHash, peerDescriptor);
              resolvedDescriptors.set(peerDescriptor.descriptorHash, parentLocator.locatorHash);
            }

            if (!peerDescriptor) {
              this.errors.push(new Error(`Unsatisfied peer dependency (${structUtils.prettyLocator(pkg)} requests ${structUtils.prettyDescriptor(peerRequest)}, but ${structUtils.prettyLocator(parentLocator)} doesn't provide it)`));
              continue;
            }

            pkg.dependencies.set(peerDescriptor.descriptorHash, peerDescriptor);
          }

          // Clear the peer dependencies since they've been resolved to specific ranges
          // If we don't clear them, they'll get re-resolved the next time we'll run Berry
          pkg.peerDependencies = new Map();
        }

        resolvePeerDependencies(pkg);
      }
    };

    for (const workspace of this.workspacesByLocator.values())
      resolvePeerDependencies(workspace.anchoredLocator);

    for (const workspace of this.workspacesByLocator.values()) {
      const pkg = allPackages.get(workspace.anchoredLocator.locatorHash);

      if (!pkg)
        throw new Error(`Expected workspace to have been resolved`);

      if (pkg.peerDependencies.size > 0)
        throw new Error(`Didn't expect workspace to have peer dependencies`);

      workspace.dependencies = pkg.dependencies;
    }

    // Everything is done, we can now update our internal resolutions to reference the new ones
    this.storedResolutions = resolvedDescriptors;
    this.storedDescriptors = allDescriptors;
    this.storedPackages = allPackages;
  }

  async fetchEverything(cache: Cache) {
    this.storedLocations = new Map();

    const fetched = new Set<string>();

    const getPluginFetchers = (hookName: string) => {
      const fetchers = [];

      for (const plugin of this.configuration.plugins.values()) {
        if (!plugin.fetchers)
          continue;

        for (const fetcher of plugin.fetchers) {
          if (fetcher.mountPoint === hookName) {
            fetchers.push(fetcher);
          }
        }
      }

      return fetchers;
    };

    const fetcher = new MultiFetcher([
      new VirtualFetcher(),
      new WorkspaceBaseFetcher(),
      new WorkspaceFetcher(),
      new MultiFetcher(
        getPluginFetchers(`virtual-fetchers`),
      ),
      new CacheFetcher(new MultiFetcher(
        getPluginFetchers(`cached-fetchers`),
      )),
    ]);

    for (const locatorHash of this.storedResolutions.values()) {
      const pkg = this.storedPackages.get(locatorHash);

      if (!pkg)
        throw new Error(`The locator should have been registered`);

      if (this.storedLocations.has(pkg.locatorHash))
        continue;

      const workspace = this.tryWorkspaceByLocator(pkg);

      if (workspace) {
        this.storedLocations.set(pkg.locatorHash, workspace.cwd);
      } else {
        const location = await fetcher.fetch(pkg, {cache, project: this, root: fetcher});
        this.storedLocations.set(pkg.locatorHash, location);
      }
    }
  }

  async generatePnpFile() {
    const pnpSettings = await extractPnpSettings(this);
    const pnpScript = generatePnpScript(pnpSettings);

    await writeFileP(this.configuration.pnpPath, pnpScript);
  }

  async install({cache}: {cache: Cache}) {
    await this.resolveEverything();
    await this.fetchEverything(cache);
    await this.generatePnpFile();
  }

  async persistLockfile() {
    // We generate the data structure that will represent our lockfile. To do this, we create a
    // reverse lookup table, where the key will be the resolved locator and the value will be a set
    // of all the descriptors that resolved to it. Then we use it to construct an optimized version
    // if the final object.
    const reverseLookup = new Map<string, Set<string>>();

    for (const [descriptorHash, locatorHash] of this.storedResolutions.entries()) {
      let descriptorHashes = reverseLookup.get(locatorHash);

      if (!descriptorHashes)
        reverseLookup.set(locatorHash, descriptorHashes = new Set());

      descriptorHashes.add(descriptorHash);;
    }

    const optimizedLockfile: {[key: string]: any} = {};

    for (const [locatorHash, descriptorHashes] of reverseLookup.entries()) {
      const pkg = this.storedPackages.get(locatorHash);

      if (!pkg)
        throw new Error(`The package should have been registered`);

      const descriptors = [];

      for (const descriptorHash of descriptorHashes) {
        const descriptor = this.storedDescriptors.get(descriptorHash);

        if (!descriptor)
          throw new Error(`The descriptor should have been registered`);

        descriptors.push(descriptor);
      }

      const key = descriptors.map(descriptor => {
        return structUtils.stringifyDescriptor(descriptor);
      }).join(`, `);

      const dependencies: {[key: string]: string} | void =
        pkg.dependencies.size > 0 ? {} : undefined;

      const peerDependencies: {[key: string]: string} | void =
        pkg.peerDependencies.size > 0 ? {} : undefined;

      if (dependencies)
        for (const dependency of pkg.dependencies.values())
          dependencies[structUtils.stringifyIdent(dependency)] = dependency.range;

      if (peerDependencies)
        for (const dependency of pkg.peerDependencies.values())
          peerDependencies[structUtils.stringifyIdent(dependency)] = dependency.range;

      optimizedLockfile[key] = {
        resolution: structUtils.stringifyLocator(pkg),
        dependencies: dependencies,
        peerDependencies: peerDependencies,
      };
    }

    const content = stringifySyml(optimizedLockfile);
    await writeFileP(`${this.cwd}/berry.lock`, content);
  }

  async persist() {
    await this.persistLockfile();
  }
}
