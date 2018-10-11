import {Resolver, ResolveOptions}     from './Resolver';
import * as structUtils               from './structUtils';
import {Descriptor, Locator, Package} from './types';

export class MultiResolver implements Resolver {
  private readonly resolvers: Array<Resolver>;

  constructor(resolvers: Array<Resolver>) {
    this.resolvers = resolvers;
  }

  supportsDescriptor(descriptor: Descriptor, opts: ResolveOptions) {
    const resolver = this.tryResolverByDescriptor(descriptor, opts);

    return resolver ? true : false;
  }

  supportsLocator(locator: Locator, opts: ResolveOptions) {
    const resolver = this.tryResolverByLocator(locator, opts);

    return resolver ? true : false;
  }

  async getCandidates(descriptor: Descriptor, opts: ResolveOptions): Promise<Array<string>> {
    const resolver = this.getResolverByDescriptor(descriptor, opts);

    return await resolver.getCandidates(descriptor, opts);
  }

  async resolve(locator: Locator, opts: ResolveOptions): Promise<Package> {
    const resolver = this.getResolverByLocator(locator, opts);

    return await resolver.resolve(locator, opts);
  }

  private tryResolverByDescriptor(descriptor: Descriptor, opts: ResolveOptions) {
    const resolver = this.resolvers.find(resolver => resolver.supportsDescriptor(descriptor, opts));

    if (!resolver)
      return null;

    return resolver;
  }

  private getResolverByDescriptor(descriptor: Descriptor, opts: ResolveOptions) {
    const resolver = this.resolvers.find(resolver => resolver.supportsDescriptor(descriptor, opts));

    if (!resolver)
      throw new Error(`Couldn't find a resolver for '${structUtils.prettyDescriptor(descriptor)}'`);

    return resolver;
  }

  private tryResolverByLocator(locator: Locator, opts: ResolveOptions) {
    const resolver = this.resolvers.find(resolver => resolver.supportsLocator(locator, opts));

    if (!resolver)
      return null;

    return resolver;
  }

  private getResolverByLocator(locator: Locator, opts: ResolveOptions) {
    const resolver = this.resolvers.find(resolver => resolver.supportsLocator(locator, opts));

    if (!resolver)
      throw new Error(`Couldn't find a resolver for '${structUtils.prettyLocator(locator)}'`);

    return resolver;
  }
}
