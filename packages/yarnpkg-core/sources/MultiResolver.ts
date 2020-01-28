import {Resolver, ResolveOptions, MinimalResolveOptions} from './Resolver';
import {assertNever}                                     from './miscUtils';

import * as structUtils                                  from './structUtils';
import {Descriptor, Locator, DescriptorHash, Package}    from './types';


export class MultiResolver implements Resolver {
  type: string | null = 'protocol';
  private readonly resolvers: Array<Resolver>;

  constructor(resolvers: Array<Resolver | null>) {
    this.resolvers = resolvers.filter(resolver => resolver) as Array<Resolver>;
  }

  addResolver(resolver: Resolver) {
    this.resolvers.push(resolver);
  }

  async supportsDescriptor(descriptor: Descriptor, opts: MinimalResolveOptions) {
    const resolver = await this.tryResolverByDescriptor(descriptor, opts);

    return resolver ? true : false;
  }

  async supportsLocator(locator: Locator, opts: MinimalResolveOptions) {
    const resolver = await this.tryResolverByLocator(locator, opts);

    return resolver ? true : false;
  }

  async shouldPersistResolution(locator: Locator, opts: MinimalResolveOptions) {
    const resolver = await this.getResolverByLocator(locator, opts);

    return await resolver.shouldPersistResolution(locator, opts);
  }

  async bindDescriptor(descriptor: Descriptor, fromLocator: Locator, opts: MinimalResolveOptions) {
    if (!opts.project) debugger;
    const resolver = await this.getResolverByDescriptor(descriptor, opts);

    return await resolver.bindDescriptor(descriptor, fromLocator, opts);
  }

  async getResolutionDependencies(descriptor: Descriptor, opts: MinimalResolveOptions) {
    const resolver = await this.getResolverByDescriptor(descriptor, opts);

    return await resolver.getResolutionDependencies(descriptor, opts);
  }

  async getCandidates(descriptor: Descriptor, dependencies: Map<DescriptorHash, Package>, opts: ResolveOptions) {
    const resolver = await this.getResolverByDescriptor(descriptor, opts);

    return await resolver.getCandidates(descriptor, dependencies, opts);
  }

  async resolve(locator: Locator, opts: ResolveOptions) {
    const resolver = await this.getResolverByLocator(locator, opts);

    return await resolver.resolve(locator, opts);
  }

  private async tryResolverByDescriptor(descriptor: Descriptor, opts: MinimalResolveOptions) {
    for (const resolver of this.resolvers)
      if (await resolver.supportsDescriptor(descriptor, opts)) return resolver;
    return null;
  }

  private async getResolverByDescriptor(descriptor: Descriptor, opts: MinimalResolveOptions) {
    for (const resolver of this.resolvers)
      if (await resolver.supportsDescriptor(descriptor, opts)) return resolver;
    throw new Error(`${structUtils.prettyDescriptor(opts.project.configuration, descriptor)} isn't supported by any available resolver`);
  }

  private async tryResolverByLocator(locator: Locator, opts: MinimalResolveOptions) {
    for (const resolver of this.resolvers)
      if (await resolver.supportsLocator(locator, opts)) return resolver;
    return null;
  }

  private async getResolverByLocator(locator: Locator, opts: MinimalResolveOptions) {
    for (const resolver of this.resolvers)
      if (await resolver.supportsLocator(locator, opts)) return resolver;
    throw new Error(`${structUtils.prettyLocator(opts.project.configuration, locator)} isn't supported by any available resolver`);
  }
}
