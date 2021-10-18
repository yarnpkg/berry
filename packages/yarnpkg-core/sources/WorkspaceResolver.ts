import {PortablePath}                                    from '@yarnpkg/fslib';

import {Resolver, ResolveOptions, MinimalResolveOptions} from './Resolver';
import {Descriptor, Locator}                             from './types';
import {LinkType}                                        from './types';

export class WorkspaceResolver implements Resolver {
  static protocol = `workspace:`;

  supportsDescriptor(descriptor: Descriptor, opts: MinimalResolveOptions) {
    if (descriptor.range.startsWith(WorkspaceResolver.protocol))
      return true;

    const workspace = opts.project.tryWorkspaceByDescriptor(descriptor);
    if (workspace !== null)
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

  getResolutionDependencies(descriptor: Descriptor, opts: MinimalResolveOptions) {
    return [];
  }

  async getCandidates(descriptor: Descriptor, dependencies: unknown, opts: ResolveOptions) {
    const workspace = opts.project.getWorkspaceByDescriptor(descriptor);

    return [workspace.anchoredLocator];
  }

  async getSatisfying(descriptor: Descriptor, references: Array<string>, opts: ResolveOptions) {
    return null;
  }

  async resolve(locator: Locator, opts: ResolveOptions) {
    const workspace = opts.project.getWorkspaceByCwd(locator.reference.slice(WorkspaceResolver.protocol.length) as PortablePath);

    return {
      ...locator,

      version: workspace.manifest.version || `0.0.0`,

      languageName: `unknown`,
      linkType: LinkType.SOFT,

      conditions: null,

      dependencies: new Map([...workspace.manifest.dependencies, ...workspace.manifest.devDependencies]),
      peerDependencies: new Map([...workspace.manifest.peerDependencies]),

      dependenciesMeta: workspace.manifest.dependenciesMeta,
      peerDependenciesMeta: workspace.manifest.peerDependenciesMeta,

      bin: workspace.manifest.bin,
    };
  }
}
