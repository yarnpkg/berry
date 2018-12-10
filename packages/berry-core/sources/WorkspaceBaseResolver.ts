import {Resolver, ResolveOptions, MinimalResolveOptions} from './Resolver';
import {WorkspaceResolver}                               from './WorkspaceResolver';
import * as structUtils                                  from './structUtils';
import {Descriptor, Locator}                             from './types';

export class WorkspaceBaseResolver implements Resolver {
  static protocol = `workspace-base:`;

  supportsDescriptor(descriptor: Descriptor, opts: MinimalResolveOptions) {
    if (!descriptor.range.startsWith(WorkspaceBaseResolver.protocol))
      return false;

    return true;
  }

  supportsLocator(locator: Locator, opts: MinimalResolveOptions) {
    if (!locator.reference.startsWith(WorkspaceBaseResolver.protocol))
      return false;

    return true;
  }

  shouldPersistResolution(locator: Locator, opts: MinimalResolveOptions) {
    return false;
  }

  async normalizeDescriptor(descriptor: Descriptor, locator: Locator, opts: MinimalResolveOptions) {
    return descriptor;
  }

  async getCandidates(descriptor: Descriptor, opts: ResolveOptions) {
    return [descriptor.range];
  }

  async resolve(locator: Locator, opts: ResolveOptions) {
    const workspace = opts.project.getWorkspaceByLocator(locator);

    const binaries = new Map(workspace.manifest.bin);
    const dependencies = new Map([... workspace.manifest.dependencies, ... workspace.manifest.devDependencies]);

    for (const workspaceCwd of workspace.workspacesCwds) {
      const childWorkspace = opts.project.getWorkspaceByCwd(workspaceCwd);

      // If the workspace being resolved has an explicit dependency on one of
      // its sub-workspaces, then we must honor it over the implicit dependency
      const hasExplicitDep = dependencies.has(childWorkspace.locator.identHash);
      if (hasExplicitDep)
        continue;

      const childDescriptor = structUtils.makeDescriptor(childWorkspace.locator, `${WorkspaceResolver.protocol}${childWorkspace.locator.reference}`);
      dependencies.set(childDescriptor.identHash, childDescriptor);
    }

    // No peer dependencies for workspaces when installed as root points
    const peerDependencies = new Map();

    return {... locator, binaries, dependencies, peerDependencies};
  }
}
