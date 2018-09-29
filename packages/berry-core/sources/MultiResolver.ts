import {Resolver, ResolveOptions}     from './Resolver';
import * as structUtils               from './structUtils';
import {Descriptor, Locator, Package} from './types';

export class MultiResolver implements Resolver {
  private readonly resolvers: Array<Resolver>;

  constructor(resolvers: Array<Resolver>) {
    this.resolvers = resolvers;
  }

  tryResolver(descriptor: Descriptor, opts: ResolveOptions) {
    const resolver = this.resolvers.find(resolver => resolver.supports(descriptor, opts));

    if (!resolver)
     return null;

    return resolver;
  }

  getResolver(descriptor: Descriptor, opts: ResolveOptions) {
    const resolver = this.resolvers.find(resolver => resolver.supports(descriptor, opts));

    if (!resolver)
      throw new Error(`Couldn't find a resolver for '${structUtils.prettyDescriptor(descriptor)}'`);

    return resolver;
  }

  supports(descriptor: Descriptor, opts: ResolveOptions): boolean {
    const resolver = this.tryResolver(descriptor, opts);

    return resolver ? true : false;
  }

  async getCandidates(descriptor: Descriptor, opts: ResolveOptions): Promise<Array<string>> {
    const resolver = this.getResolver(descriptor, opts);

    return await resolver.getCandidates(descriptor, opts);
  }

  async resolve(locator: Locator, opts: ResolveOptions): Promise<Package> {
    const resolver = this.getResolver(structUtils.convertLocatorToDescriptor(locator), opts);

    return await resolver.resolve(locator, opts);
  }
}
