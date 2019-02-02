import {ReportError, MessageName}                        from './Report';
import {Resolver, ResolveOptions, MinimalResolveOptions} from './Resolver';
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
    const candidateWorkspaces = opts.project.findWorkspacesByDescriptor(descriptor);

    if (candidateWorkspaces.length < 1) {
      if (!opts.project.workspacesByIdent.has(descriptor.identHash)) {
        throw new ReportError(MessageName.WORKSPACE_NOT_FOUND, `No local workspace found for this name`);
      } else {
        throw new ReportError(MessageName.WORKSPACE_NOT_FOUND, `No local workspace found for this range`);
      }
    }
    
    if (candidateWorkspaces.length > 1)
      throw new ReportError(MessageName.TOO_MANY_MATCHING_WORKSPACES, `Too many workspaces match this range, please disambiguate`);

    return [candidateWorkspaces[0].anchoredLocator];
  }

  async resolve(locator: Locator, opts: ResolveOptions) {
    const workspace = opts.project.getWorkspaceByCwd(locator.reference.slice(WorkspaceResolver.protocol.length));

    const version = workspace.manifest.version || `0.0.0`;

    const languageName = `unknown`;
    const linkType = LinkType.SOFT;

    const dependencies = new Map([... workspace.manifest.dependencies, ... workspace.manifest.devDependencies]);
    const peerDependencies = new Map([... workspace.manifest.peerDependencies]);

    return {... locator, version, languageName, linkType, dependencies, peerDependencies};
  }
}
