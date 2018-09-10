// @ts-ignore
import Logic = require('logic-solver');

import {existsSync, readFile, writeFile}                      from 'fs';
import {dirname}                                              from 'path';
import {promisify}                                            from 'util';

import {Fetcher as GithubFetcher, Resolver as GithubResolver} from '@berry/github';
import {Fetcher as NpmFetcher, Resolver as NpmResolver}       from '@berry/npm';
import {parseSyml, stringifySyml}                             from '@berry/parsers';
import {extractPnpSettings, generatePnpScript}                from '@berry/pnp';

import {Cache}                                                from './Cache';
import {Configuration}                                        from './Configuration';
import {MultiFetcher}                                         from './MultiFetcher';
import {MultiResolver}                                        from './MultiResolver';
import {Resolver}                                             from './Resolver';
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

  async setupResolutions() {
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

  async setupWorkspaces({force = false}: {force?: boolean} = {}) {
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

  findWorkspaceByDescriptor(descriptor: Descriptor) {
    const candidateWorkspaces = this.workspacesByIdent.get(descriptor.identHash);

    if (!candidateWorkspaces)
      return null;

    const selectedWorkspace = candidateWorkspaces.find(workspace => workspace.accepts(descriptor.range));

    if (!selectedWorkspace)
      return null;

    return selectedWorkspace;
  }

  makeWorkspaceResolver(): Resolver {
    const project = this;
    return {
      supports(descriptor: Descriptor): boolean {
        if (descriptor.range === `local-workspace`)
          return true;

        const candidateWorkspace = project.findWorkspaceByDescriptor(descriptor);

        if (!candidateWorkspace)
          return false;

        return true;
      },

      async getCandidates(descriptor: Descriptor): Promise<Array<string>> {
        if (descriptor.range === `local-workspace`) {
          const candidateWorkspaces = project.workspacesByIdent.get(descriptor.identHash);

          if (!candidateWorkspaces || candidateWorkspaces.length < 1)
            throw new Error(`This range can only be resolved by a local workspace, but none match the ident`);

          if (candidateWorkspaces.length > 1)
            throw new Error(`This range must be resolved by exactly one local workspace, too many found`);

          return [candidateWorkspaces[0].locator.reference];
        } else {
          const candidateWorkspace = project.findWorkspaceByDescriptor(descriptor);

          if (!candidateWorkspace)
            throw new Error(`Expected to find a valid workspace, but none found`);

          return [candidateWorkspace.locator.reference];
        }
      },

      async resolve(locator: Locator): Promise<Package> {
        const workspace = project.getWorkspaceByLocator(locator);

        return {... locator, dependencies: workspace.dependencies, peerDependencies: workspace.peerDependencies};
      }
    };
  }

  makeLockfileResolver(): Resolver {
    const project = this;
    return {
      supports(descriptor: Descriptor): boolean {
        if (project.storedResolutions.has(descriptor.descriptorHash))
          return true;

        if (project.storedPackages.has(structUtils.convertDescriptorToLocator(descriptor).locatorHash))
          return true;

        return false;
      },

      async getCandidates(descriptor: Descriptor): Promise<Array<string>> {
        const resolution = project.storedResolutions.get(descriptor.descriptorHash);

        if (!resolution)
          throw new Error(`Expected the resolution to have been successful`);

        const pkg = project.storedPackages.get(resolution);

        if (!pkg)
          throw new Error(`Expected the resolution to have been successful`);

        return [pkg.reference];
      },

      async resolve(locator: Locator): Promise<Package> {
        const pkg = project.storedPackages.get(locator.locatorHash);

        if (!pkg)
          throw new Error(`The lockfile resolver isn't meant to resolve packages - they should already have been stored into a cache`);

        return pkg;
      }
    };
  }

  async resolveEverything() {
    if (!this.workspacesByCwd || !this.workspacesByIdent)
      throw new Error(`Workspaces must have been setup before calling this function`);

    const resolver = new MultiResolver([
      this.makeWorkspaceResolver(),
      this.makeLockfileResolver(),
      new GithubResolver(),
      new NpmResolver(),
    ]);

    const allDescriptors = new Map<string, Descriptor>();
    const allLocators = new Map<string, Locator>();
    const allPackages = new Map<string, Package>(this.storedPackages);

    const haveBeenResolved = new Map<string, string>();
    let mustBeResolved = new Set<string>();

    const allResolutions = new Set<string>();

    for (const workspace of this.workspacesByLocator.values()) {
      for (const store of [workspace.dependencies, workspace.devDependencies]) {
        for (const descriptor of store.values()) {
          allDescriptors.set(descriptor.descriptorHash, descriptor);
          mustBeResolved.add(descriptor.descriptorHash);
        }
      }
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

        if (haveBeenResolved.has(descriptor.descriptorHash))
          return;

        const candidateReferences = await resolver.getCandidates(descriptor);

        // Reversing it make the following algorithm prioritize the more recent releases
        candidateReferences.reverse();

        if (candidateReferences.length === 0)
          throw new Error(`No candidate found for ${structUtils.prettyDescriptor(descriptor)}`);

        if (candidateReferences.length === 1) {
          const locator = structUtils.makeLocatorFromDescriptor(descriptor, candidateReferences[0]);

          allLocators.set(locator.locatorHash, locator);
          haveBeenResolved.set(descriptor.descriptorHash, locator.locatorHash);

          if (!allResolutions.has(locator.locatorHash)) {
            allResolutions.add(locator.locatorHash);
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
        const selectedHash = locatorHashes.find(locatorHash => allResolutions.has(locatorHash));

        if (selectedHash) {
          haveBeenResolved.set(descriptorHash, selectedHash);
          allCandidates.delete(descriptorHash);
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

          haveBeenResolved.set(descriptorHash, solutionHash);
        }

        for (const locatorHash of solutionSet) {
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

        const pkg = allPackages.get(locator.locatorHash) || await resolver.resolve(locator);
        allPackages.set(pkg.locatorHash, pkg);

        for (const descriptor of pkg.dependencies.values()) {
          if (!haveBeenResolved.has(descriptor.descriptorHash)) {
            allDescriptors.set(descriptor.descriptorHash, descriptor);
            mustBeResolved.add(descriptor.descriptorHash);
          }
        }
      }));
    }

    // Everything is done, we can now update our internal resolutions to reference the new ones
    this.storedResolutions = haveBeenResolved;
    this.storedDescriptors = allDescriptors;
    this.storedPackages = allPackages;
  }

  async fetchEverything(cache: Cache) {
    this.storedLocations = new Map();

    const fetched = new Set<string>();
    const fetcher = new MultiFetcher([
      new NpmFetcher(),
      new GithubFetcher(),
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
        this.storedLocations.set(pkg.locatorHash, await cache.fetchFromCache(pkg, async () => {
          return await fetcher.fetch(pkg);
        }));
      }
    }
  }

  async generatePnpFile() {
    const pnpSettings = await extractPnpSettings(this);
    const pnpScript = generatePnpScript(pnpSettings);

    await writeFileP(this.configuration.pnpPath, pnpScript);
  }

  async install({cache}: {cache: Cache}) {
    await cache.setup();

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
      };
    }

    const content = stringifySyml(optimizedLockfile);
    await writeFileP(`${this.cwd}/berry.lock`, content);
  }

  async persist() {
    await this.persistLockfile();
  }
}
