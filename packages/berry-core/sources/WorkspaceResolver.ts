import {Resolver, ResolveOptions, MinimalResolveOptions} from './Resolver';
import * as structUtils                                  from './structUtils';
import {Descriptor, Locator}                             from './types';

export class WorkspaceResolver implements Resolver {
  static protocol = `workspace:`;

  supportsDescriptor(descriptor: Descriptor, opts: MinimalResolveOptions) {
    if (descriptor.range.startsWith(WorkspaceResolver.protocol))
      return true;

    const matchingWorkspaces = opts.project.findWorkspacesByDescriptor(descriptor);

    if (matchingWorkspaces.length === 0)
      return false;

    return true;
  }

  supportsLocator(locator: Locator, opts: MinimalResolveOptions) {
    if (locator.reference.startsWith(WorkspaceResolver.protocol))
      return true;

    return false;
  }

  shouldPersistResolution(locator: Locator, opts: MinimalResolveOptions) {
    return false;
  }

  async normalizeDescriptor(descriptor: Descriptor, fromLocator: Locator, opts: MinimalResolveOptions) {
    return descriptor;
  }

  async getCandidates(descriptor: Descriptor, opts: ResolveOptions) {
    if (descriptor.range.startsWith(WorkspaceResolver.protocol))
      descriptor = structUtils.makeDescriptor(descriptor, descriptor.range.slice(WorkspaceResolver.protocol.length));

    const candidateWorkspaces = opts.project.findWorkspacesByDescriptor(descriptor);

    if (candidateWorkspaces.length < 1)
      throw new Error(`This range can only be resolved by a local workspace, but none match the specified range`);

    if (candidateWorkspaces.length > 1)
      throw new Error(`This range must be resolved by exactly one local workspace, too many found`);

    return [`${WorkspaceResolver.protocol}${candidateWorkspaces[0].locator.reference}`];
  }

  async resolve(locator: Locator, opts: ResolveOptions) {
    const workspace = opts.project.getWorkspaceByLocator(locator);

    const binaries = new Map(workspace.manifest.bin);
    const dependencies = new Map(workspace.manifest.dependencies);
    const peerDependencies = new Map(workspace.manifest.peerDependencies);

    for (const workspaceCwd of workspace.workspacesCwds) {
      const childWorkspace = opts.project.getWorkspaceByCwd(workspaceCwd);

      const hasDep = Array.from(dependencies.values()).some(descriptor => descriptor.identHash === childWorkspace.locator.identHash);
      const hasPeerDep = Array.from(dependencies.values()).some(descriptor => descriptor.identHash === childWorkspace.locator.identHash);

      if (!hasDep && !hasPeerDep) {
        const childDescriptor = structUtils.makeDescriptor(childWorkspace.locator, `${WorkspaceResolver.protocol}${childWorkspace.locator}`);
        dependencies.set(childDescriptor.descriptorHash, childDescriptor);
      }
    }

    return {... locator, binaries, dependencies, peerDependencies};
  }
}
