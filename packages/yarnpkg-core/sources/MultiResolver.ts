import {Resolver, ResolveOptions, MinimalResolveOptions} from './Resolver';
import * as structUtils                                  from './structUtils';
import {Descriptor, Locator, DescriptorHash, Package}    from './types';

export class MultiResolver implements Resolver {
  private readonly resolvers: Array<Resolver>;

  constructor(resolvers: Array<Resolver | null>) {
    this.resolvers = resolvers.filter(resolver => resolver) as Array<Resolver>;
  }

  supportsDescriptor(descriptor: Descriptor, opts: MinimalResolveOptions) {
    const resolver = this.tryResolverByDescriptor(descriptor, opts);

    return !!resolver;
  }

  supportsLocator(locator: Locator, opts: MinimalResolveOptions) {
    const resolver = this.tryResolverByLocator(locator, opts);

    return !!resolver;
  }

  shouldPersistResolution(locator: Locator, opts: MinimalResolveOptions) {
    const resolver = this.getResolverByLocator(locator, opts);

    return resolver.shouldPersistResolution(locator, opts);
  }

  bindDescriptor(descriptor: Descriptor, fromLocator: Locator, opts: MinimalResolveOptions) {
    const resolver = this.getResolverByDescriptor(descriptor, opts);

    return resolver.bindDescriptor(descriptor, fromLocator, opts);
  }

  getResolutionDependencies(descriptor: Descriptor, opts: MinimalResolveOptions) {
    const resolver = this.getResolverByDescriptor(descriptor, opts);

    return resolver.getResolutionDependencies(descriptor, opts);
  }

  async getCandidates(descriptor: Descriptor, dependencies: Map<DescriptorHash, Package>, opts: ResolveOptions) {
    const resolver = this.getResolverByDescriptor(descriptor, opts);

    return await resolver.getCandidates(descriptor, dependencies, opts);
  }

  async resolve(locator: Locator, opts: ResolveOptions) {
    const resolver = this.getResolverByLocator(locator, opts);

    return await resolver.resolve(locator, opts);
  }

  private tryResolverByDescriptor(descriptor: Descriptor, opts: MinimalResolveOptions) {
    const resolver = this.resolvers.find(resolver => resolver.supportsDescriptor(descriptor, opts));

    if (!resolver)
      return null;

    return resolver;
  }

  private getResolverByDescriptor(descriptor: Descriptor, opts: MinimalResolveOptions) {
    const resolver = this.resolvers.find(resolver => resolver.supportsDescriptor(descriptor, opts));

    if (!resolver)
      throw new Error(`${structUtils.prettyDescriptor(opts.project.configuration, descriptor)} isn't supported by any available resolver`);

    return resolver;
  }

  private tryResolverByLocator(locator: Locator, opts: MinimalResolveOptions) {
    const resolver = this.resolvers.find(resolver => resolver.supportsLocator(locator, opts));

    if (!resolver)
      return null;

    return resolver;
  }

  private getResolverByLocator(locator: Locator, opts: MinimalResolveOptions) {
    const resolver = this.resolvers.find(resolver => resolver.supportsLocator(locator, opts));

    if (!resolver)
      throw new Error(`${structUtils.prettyLocator(opts.project.configuration, locator)} isn't supported by any available resolver`);

    return resolver;
  }
}
