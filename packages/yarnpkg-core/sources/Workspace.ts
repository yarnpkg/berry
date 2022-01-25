import {PortablePath, npath, ppath, xfs, Filename} from '@yarnpkg/fslib';
import globby                                      from 'globby';

import {HardDependencies, Manifest}                from './Manifest';
import {Project}                                   from './Project';
import {WorkspaceResolver}                         from './WorkspaceResolver';
import * as hashUtils                              from './hashUtils';
import * as semverUtils                            from './semverUtils';
import * as structUtils                            from './structUtils';
import {IdentHash}                                 from './types';
import {Descriptor, Locator}                       from './types';

export class Workspace {
  public readonly project: Project;
  public readonly cwd: PortablePath;

  // @ts-expect-error: This variable is set during the setup process
  public readonly relativeCwd: PortablePath;

  // @ts-expect-error: This variable is set during the setup process
  public readonly anchoredDescriptor: Descriptor;

  // @ts-expect-error: This variable is set during the setup process
  public readonly anchoredLocator: Locator;

  // @ts-expect-error: This variable is set during the setup process
  public readonly locator: Locator;

  // @ts-expect-error: This variable is set during the setup process
  public readonly manifest: Manifest;

  public readonly workspacesCwds: Set<PortablePath> = new Set();

  // Generated at resolution; basically dependencies + devDependencies + child workspaces
  public dependencies: Map<IdentHash, Descriptor> = new Map();

  constructor(workspaceCwd: PortablePath, {project}: {project: Project}) {
    this.project = project;
    this.cwd = workspaceCwd;
  }

  async setup() {
    // @ts-expect-error: It's ok to initialize it now
    this.manifest = await Manifest.tryFind(this.cwd) ?? new Manifest();

    // We use ppath.relative to guarantee that the default hash will be consistent even if the project is installed on different OS / path
    // @ts-expect-error: It's ok to initialize it now, even if it's readonly (setup is called right after construction)
    this.relativeCwd = ppath.relative(this.project.cwd, this.cwd) || PortablePath.dot;

    const ident = this.manifest.name ? this.manifest.name : structUtils.makeIdent(null, `${this.computeCandidateName()}-${hashUtils.makeHash<string>(this.relativeCwd).substr(0, 6)}`);
    const reference = this.manifest.version ? this.manifest.version : `0.0.0`;

    // @ts-expect-error: It's ok to initialize it now, even if it's readonly (setup is called right after construction)
    this.locator = structUtils.makeLocator(ident, reference);

    // @ts-expect-error: It's ok to initialize it now, even if it's readonly (setup is called right after construction)
    this.anchoredDescriptor = structUtils.makeDescriptor(this.locator, `${WorkspaceResolver.protocol}${this.relativeCwd}`);

    // @ts-expect-error: It's ok to initialize it now, even if it's readonly (setup is called right after construction)
    this.anchoredLocator = structUtils.makeLocator(this.locator, `${WorkspaceResolver.protocol}${this.relativeCwd}`);

    const patterns = this.manifest.workspaceDefinitions.map(({pattern}) => pattern);

    const relativeCwds = await globby(patterns, {
      cwd: npath.fromPortablePath(this.cwd),
      expandDirectories: false,
      onlyDirectories: true,
      onlyFiles: false,
      ignore: [`**/node_modules`, `**/.git`, `**/.yarn`],
    });

    // It seems that the return value of globby isn't in any guaranteed order - not even the directory listing order
    relativeCwds.sort();

    for (const relativeCwd of relativeCwds) {
      const candidateCwd = ppath.resolve(this.cwd, npath.toPortablePath(relativeCwd));

      if (xfs.existsSync(ppath.join(candidateCwd, `package.json` as Filename))) {
        this.workspacesCwds.add(candidateCwd);
      }
    }
  }

  accepts(range: string) {
    const protocolIndex = range.indexOf(`:`);

    const protocol = protocolIndex !== -1
      ? range.slice(0, protocolIndex + 1)
      : null;

    const pathname = protocolIndex !== -1
      ? range.slice(protocolIndex + 1)
      : range;

    if (protocol === WorkspaceResolver.protocol && ppath.normalize(pathname as PortablePath) === this.relativeCwd)
      return true;

    if (protocol === WorkspaceResolver.protocol && (pathname === `*` || pathname === `^` || pathname === `~`))
      return true;

    const semverRange = semverUtils.validRange(pathname);
    if (!semverRange)
      return false;

    if (protocol === WorkspaceResolver.protocol)
      return semverRange.test(this.manifest.version ?? `0.0.0`);

    if (!this.project.configuration.get(`enableTransparentWorkspaces`))
      return false;

    if (this.manifest.version !== null)
      return semverRange.test(this.manifest.version);

    return false;
  }

  computeCandidateName() {
    if (this.cwd === this.project.cwd) {
      return `root-workspace`;
    } else {
      return `${ppath.basename(this.cwd)}` || `unnamed-workspace`;
    }
  }

  /**
   * Find workspaces marked as dependencies/devDependencies of the current workspace recursively.
   *
   * @param rootWorkspace root workspace
   * @param project project
   *
   * @returns all the workspaces marked as dependencies
   */
  getRecursiveWorkspaceDependencies({dependencies = Manifest.hardDependencies}: {dependencies?: Array<HardDependencies>} = {}) {
    const workspaceList = new Set<Workspace>();

    const visitWorkspace = (workspace: Workspace) => {
      for (const dependencyType of dependencies) {
        // Quick note: it means that if we have, say, a workspace in
        // dev dependencies but not in dependencies, this workspace will be
        // traversed (even if dependencies traditionally override dev
        // dependencies). It's not clear which behaviour is better, but
        // at least it's consistent.
        for (const descriptor of workspace.manifest[dependencyType].values()) {
          const foundWorkspace = this.project.tryWorkspaceByDescriptor(descriptor);
          if (foundWorkspace === null || workspaceList.has(foundWorkspace))
            continue;

          workspaceList.add(foundWorkspace);
          visitWorkspace(foundWorkspace);
        }
      }
    };

    visitWorkspace(this);
    return workspaceList;
  }

  /**
   * Find workspaces which include the current workspace as a dependency/devDependency recursively.
   *
   * @param rootWorkspace root workspace
   * @param project project
   *
   * @returns all the workspaces marked as dependents
   */
  getRecursiveWorkspaceDependents({dependencies = Manifest.hardDependencies}: {dependencies?: Array<HardDependencies>} = {}) {
    const workspaceList = new Set<Workspace>();

    const visitWorkspace = (workspace: Workspace) => {
      for (const projectWorkspace of this.project.workspaces) {
        const isDependent = dependencies.some(dependencyType => {
          return [...projectWorkspace.manifest[dependencyType].values()].some(descriptor => {
            const foundWorkspace = this.project.tryWorkspaceByDescriptor(descriptor);
            return foundWorkspace !== null && structUtils.areLocatorsEqual(foundWorkspace.anchoredLocator, workspace.anchoredLocator);
          });
        });

        if (isDependent && !workspaceList.has(projectWorkspace)) {
          workspaceList.add(projectWorkspace);
          visitWorkspace(projectWorkspace);
        }
      }
    };

    visitWorkspace(this);
    return workspaceList;
  }

  /**
   * Retrieves all the child workspaces of a given root workspace recursively
   *
   * @param rootWorkspace root workspace
   * @param project project
   *
   * @returns all the child workspaces
   */
  getRecursiveWorkspaceChildren() {
    const workspaceList: Array<Workspace> = [];

    for (const childWorkspaceCwd of this.workspacesCwds) {
      const childWorkspace = this.project.workspacesByCwd.get(childWorkspaceCwd);

      if (childWorkspace) {
        workspaceList.push(childWorkspace, ...childWorkspace.getRecursiveWorkspaceChildren());
      }
    }

    return workspaceList;
  }

  async persistManifest() {
    const data = {};
    this.manifest.exportTo(data);

    const path = ppath.join(this.cwd, Manifest.fileName);
    const content = `${JSON.stringify(data, null, this.manifest.indent)}\n`;

    await xfs.changeFilePromise(path, content, {
      automaticNewlines: true,
    });

    this.manifest.raw = data;
  }
}
