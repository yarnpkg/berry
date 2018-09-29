import {Resolver, ResolveOptions} from './Resolver';
import * as structUtils           from './structUtils';
import {Descriptor, Locator}      from './types';

export class WorkspaceBaseResolver implements Resolver {
  static protocol = `workspace-base:`;

  supports(descriptor: Descriptor, opts: ResolveOptions) {
    if (!descriptor.range.startsWith(WorkspaceBaseResolver.protocol))
      return false;

    return true;
  }

  async getCandidates(descriptor: Descriptor, opts: ResolveOptions) {
    return [descriptor.range];
  }

  async resolve(locator: Locator, opts: ResolveOptions) {
    const normalizedLocator = structUtils.makeLocatorFromIdent(locator, locator.reference.slice(WorkspaceBaseResolver.protocol.length));

    const workspace = opts.project.getWorkspaceByLocator(normalizedLocator);

    const dependencies = new Map([... workspace.manifest.dependencies, ... workspace.manifest.devDependencies]);
    const peerDependencies = new Map(); // No peer dependencies for workspaces when installed as root points

    return {... locator, dependencies, peerDependencies};
  }
}
