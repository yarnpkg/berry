import {MessageName, ReportError}                        from './Report';
import {Resolver, ResolveOptions, MinimalResolveOptions} from './Resolver';
import * as structUtils                                  from './structUtils';
import {Descriptor, Locator, Package}                    from './types';

export class MultiResolver implements Resolver {
  private readonly resolvers: Array<Resolver>;

  constructor(resolvers: Array<Resolver | null>) {
    this.resolvers = resolvers.filter(resolver => resolver) as Array<Resolver>;
  }

  supportsDescriptor(descriptor: Descriptor, opts: MinimalResolveOptions) {
    const resolver = this.tryResolverByDescriptor(descriptor, opts);

    return resolver ? true : false;
  }

  supportsLocator(locator: Locator, opts: MinimalResolveOptions) {
    const resolver = this.tryResolverByLocator(locator, opts);

    return resolver ? true : false;
  }

  shouldPersistResolution(locator: Locator, opts: MinimalResolveOptions) {
    const resolver = this.getResolverByLocator(locator, opts);

    return resolver.shouldPersistResolution(locator, opts);
  }

  bindDescriptor(descriptor: Descriptor, fromLocator: Locator, opts: MinimalResolveOptions): Descriptor {
    const resolver = this.getResolverByDescriptor(descriptor, opts);

    return resolver.bindDescriptor(descriptor, fromLocator, opts);
  }

  async getCandidates(descriptor: Descriptor, opts: ResolveOptions): Promise<Array<string>> {
    const resolver = this.getResolverByDescriptor(descriptor, opts);

    return await resolver.getCandidates(descriptor, opts);
  }

  async resolve(locator: Locator, opts: ResolveOptions): Promise<Package> {
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
      throw new ReportError(MessageName.RESOLVER_NOT_FOUND, `${structUtils.prettyDescriptor(opts.project.configuration, descriptor)} isn't supported by any available resolver`);

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
      throw new Error(`Couldn't find a resolver for ${structUtils.prettyLocator(opts.project.configuration, locator)}`);

    return resolver;
  }
}
