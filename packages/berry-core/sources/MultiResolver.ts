import {Resolver}                     from './Resolver';
import * as structUtils               from './structUtils';
import {Descriptor, Locator, Package} from './types';

export class MultiResolver implements Resolver {
  private readonly resolvers: Array<Resolver>;

  constructor(resolvers: Array<Resolver>) {
    this.resolvers = resolvers;
  }

  tryResolver(descriptor: Descriptor) {
    const resolver = this.resolvers.find(resolver => resolver.supports(descriptor));

    if (!resolver)
     return null;

    return resolver;
  }

  getResolver(descriptor: Descriptor) {
    const resolver = this.resolvers.find(resolver => resolver.supports(descriptor));

    if (!resolver)
      throw new Error(`Couldn't find a resolver for '${structUtils.prettyDescriptor(descriptor)}'`);

    return resolver;
  }

  supports(descriptor: Descriptor): boolean {
    const resolver = this.tryResolver(descriptor);

    return resolver ? true : false;
  }

  async getCandidates(descriptor: Descriptor): Promise<Array<string>> {
    const resolver = this.getResolver(descriptor);

    return await resolver.getCandidates(descriptor);
  }

  async resolve(locator: Locator): Promise<Package> {
    const resolver = this.getResolver(structUtils.convertLocatorToDescriptor(locator));

    return await resolver.resolve(locator);
  }
}
