import semver                                            from 'semver';

import {Resolver, ResolveOptions, MinimalResolveOptions} from './Resolver';
import * as semverUtils                                  from './semverUtils';
import * as structUtils                                  from './structUtils';
import {Descriptor, Locator, DescriptorHash, Package}    from './types';

export const TAG_REGEXP = /^(?!v)[a-z0-9._-]+$/i;

export class ProtocolResolver implements Resolver {
  private resolver: Resolver;

  constructor(resolver: Resolver) {
    this.resolver = resolver;
  }

  supportsDescriptor(descriptor: Descriptor, opts: MinimalResolveOptions) {
    return this.resolver.supportsDescriptor(descriptor, opts);
  }

  supportsLocator(locator: Locator, opts: MinimalResolveOptions) {
    return this.resolver.supportsLocator(locator, opts);
  }

  shouldPersistResolution(locator: Locator, opts: MinimalResolveOptions) {
    return this.resolver.shouldPersistResolution(locator, opts);
  }

  bindDescriptor(descriptor: Descriptor, fromLocator: Locator, opts: MinimalResolveOptions) {
    return this.resolver.bindDescriptor(descriptor, fromLocator, opts);
  }

  getResolutionDependencies(descriptor: Descriptor, opts: MinimalResolveOptions) {
    const dependencies = this.resolver.getResolutionDependencies(descriptor, opts);

    return Object.fromEntries(
      Object.entries(dependencies).map(([dependencyName, descriptor]) => {
        return [dependencyName, this.applyProtocol(descriptor, opts)];
      }),
    );
  }

  async getCandidates(descriptor: Descriptor, dependencies: Record<string, Package>, opts: ResolveOptions) {
    return await this.resolver.getCandidates(descriptor, dependencies, opts);
  }

  async getSatisfying(descriptor: Descriptor, references: Array<string>, opts: ResolveOptions) {
    return await this.resolver.getSatisfying(descriptor, references, opts);
  }

  async resolve(locator: Locator, opts: ResolveOptions) {
    const pkg = await this.resolver.resolve(locator, opts);

    return {
      ...pkg,
      dependencies: new Map([...pkg.dependencies].map(([identHash, dependency]) => {
        return [identHash, this.applyProtocol(dependency, opts)];
      })),
    };
  }

  private applyProtocol(descriptor: Descriptor, opts: MinimalResolveOptions) {
    if (semver.validRange(descriptor.range))
      return structUtils.makeDescriptor(descriptor, `${opts.project.configuration.get(`defaultProtocol`)}${descriptor.range}`);

    if (TAG_REGEXP.test(descriptor.range))
      return structUtils.makeDescriptor(descriptor, `${opts.project.configuration.get(`defaultProtocol`)}${descriptor.range}`);

    return descriptor;
  }
}
