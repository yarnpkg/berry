import {Resolver, ResolveOptions, MinimalResolveOptions} from './Resolver';
import {WorkspaceResolver}                               from './WorkspaceResolver';
import * as structUtils                                  from './structUtils';
import {Descriptor, Locator}                             from './types';
import {LinkType}                                        from './types';

export class WorkspaceBaseResolver implements Resolver {
  static protocol = `workspace-base:`;

  static isWorkspaceBaseDescriptor(descriptor: Descriptor) {
    if (!descriptor.range.startsWith(WorkspaceBaseResolver.protocol))
      return false;

    return true;
  }

  static isWorkspaceBaseLocator(locator: Locator) {
    if (!locator.reference.startsWith(WorkspaceBaseResolver.protocol))
      return false;

    return true;
  }

  supportsDescriptor(descriptor: Descriptor, opts: MinimalResolveOptions) {
    return WorkspaceBaseResolver.isWorkspaceBaseDescriptor(descriptor);
  }

  supportsLocator(locator: Locator, opts: MinimalResolveOptions) {
    return WorkspaceBaseResolver.isWorkspaceBaseLocator(locator);
  }

  shouldPersistResolution(locator: Locator, opts: MinimalResolveOptions) {
    return false;
  }

  normalizeDescriptor(descriptor: Descriptor, locator: Locator, opts: MinimalResolveOptions) {
    return descriptor;
  }

  async getCandidates(descriptor: Descriptor, opts: ResolveOptions) {
    return [descriptor.range];
  }

  async resolve(locator: Locator, opts: ResolveOptions) {
    const workspace = opts.project.getWorkspaceByLocator(locator);

    const languageName = `unknown`;
    const linkType = LinkType.SOFT;

    const dependencies = new Map([... workspace.manifest.dependencies, ... workspace.manifest.devDependencies]);
    const peerDependencies = new Map();

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
