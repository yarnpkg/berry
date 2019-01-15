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
    if (matchingWorkspaces.length > 0)
      return true;

    return false;
  }

  supportsLocator(locator: Locator, opts: MinimalResolveOptions) {
    if (!locator.reference.startsWith(WorkspaceResolver.protocol))
      return false;

    return true;
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

    const version = workspace.manifest.version || `0.0.0`;

    const languageName = `unknown`;
    const linkType = LinkType.SOFT;

    const dependencies = new Map([... workspace.manifest.dependencies, ... workspace.manifest.devDependencies]);
    const peerDependencies = new Map([... workspace.manifest.peerDependencies]);

    return {... locator, version, languageName, linkType, dependencies, peerDependencies};
  }
}
