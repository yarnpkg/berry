import {Resolver, ResolveOptions, MinimalResolveOptions} from './Resolver';
import * as structUtils                                  from './structUtils';
import {Descriptor, Locator}                             from './types';
import {LinkType}                                        from './types';

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

  bindDescriptor(descriptor: Descriptor, fromLocator: Locator, opts: MinimalResolveOptions) {
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

    return [structUtils.makeLocator(descriptor, `${WorkspaceResolver.protocol}${candidateWorkspaces[0].locator.reference}`)];
  }

  async resolve(locator: Locator, opts: ResolveOptions) {
    const workspace = opts.project.getWorkspaceByLocator(locator);

    const languageName = opts.project.configuration.defaultLanguageName;
    const linkType = LinkType.SOFT;

    const dependencies = new Map(workspace.manifest.dependencies);
    const peerDependencies = new Map(workspace.manifest.peerDependencies);

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

    return {... locator, languageName, linkType, dependencies, peerDependencies};
  }
}
