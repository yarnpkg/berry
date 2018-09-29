import {Resolver, ResolveOptions} from './Resolver';
import * as structUtils           from './structUtils';
import {Descriptor, Locator}      from './types';

export class WorkspaceResolver implements Resolver {
  static protocol = `workspace:`;

  supports(descriptor: Descriptor, opts: ResolveOptions) {
    if (descriptor.range.startsWith(WorkspaceResolver.protocol))
      return true;

    const matchingWorkspaces = opts.project.findWorkspacesByDescriptor(descriptor);

    if (matchingWorkspaces.length === 0)
      return false;

    return true;
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
    const normalizedLocator = structUtils.makeLocatorFromIdent(locator, locator.reference.slice(WorkspaceResolver.protocol.length));

    const workspace = opts.project.getWorkspaceByLocator(normalizedLocator);

    const dependencies = new Map(workspace.manifest.dependencies);
    const peerDependencies = new Map(workspace.manifest.peerDependencies);

    return {... locator, dependencies, peerDependencies};
  }
}
