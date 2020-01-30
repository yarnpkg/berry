import {Fetcher}                                         from './Fetcher';
import {MultiFetcher}                                    from './MultiFetcher';
import {MultiResolver}                                   from './MultiResolver';
import {Resolver, ResolveOptions, MinimalResolveOptions} from './Resolver';
import {Descriptor, Locator, DescriptorHash, Package}    from './types';

// The CoreResolver and CoreFetcher classes are controllers for the actual resolvers/fetchers.
// This description uses a resolver for example, but the logic is the same for fetchers.
// All resolvers with type 'module' are stored in an array `resolvers.module`
// All resolvers with anything else (ie. type: 'protocol') are loaded into a MultiResolver
// and stored in `resolvers.protocol`.
// The logic is that the first loaded module is consulted first with the following options
// {next: nextResolver, proto: resolvers.proto}. The resolver can choose to return a response,
// or consult the next resolver in the chain, or consult the protocol resolvers.
// `next` is a wrapper function to call the next resolver passing it the resolver after that

export class ResolverController implements Resolver {
  public readonly type = 'module';
  private readonly index = new Map<Resolver, Resolver | undefined>(); // map of each module resolver to the next in the chain
  private readonly protocols = new MultiResolver([]); // a MultiResolver aggregating all protocol resolvers
  private readonly modules = new Array<Resolver>(); // an array of all modules (mostly to keep track of which to call first)

  constructor(resolvers: Array<Resolver>) {
    resolvers.forEach( (resolver) => { // categorize each plugin
      if (resolver && resolver.type === 'module') {
        this.modules.push(resolver);
      } else if (resolver) {
        this.protocols.addResolver(resolver);
      }
    } );
    for (let i=0; i < this.modules.length; i++) { // create a map of each module with its next (ie. the chain of module resolvers)
      this.index.set(this.modules[i], this.modules[i+1]);
    }
  }

  prepareNext(func: string, resolver: Resolver | undefined, ...args: any): any {
    if (resolver) {
      const next = this.index.get(resolver); // if next is undefined the `prepareNext` will use the protocol MultiResolver
      return (resolver as any)[func].bind(resolver, ...args, this.prepareNext(func, next, ...args), this.protocols);
    } else {
      return (this.protocols as any)[func].bind(this.protocols, ...args);
    }
  }

  async supportsDescriptor(descriptor: Descriptor, opts: MinimalResolveOptions): Promise<boolean> {
    return await this.prepareNext('supportsDescriptor', this.modules[0], descriptor, opts)();
  }
  async supportsLocator(locator: Locator, opts: MinimalResolveOptions): Promise<boolean> {
    return await this.prepareNext('supportsLocator', this.modules[0], locator, opts)();
  }
  async shouldPersistResolution(locator: Locator, opts: MinimalResolveOptions): Promise<boolean> {
    return await this.prepareNext('shouldPersistResolution', this.modules[0], locator, opts)();
  }
  async bindDescriptor(descriptor: Descriptor, fromLocator: Locator, opts: MinimalResolveOptions): Promise<Descriptor> {
    return await this.prepareNext('bindDescriptor', this.modules[0], descriptor, fromLocator, opts)();
  }
  async getResolutionDependencies(descriptor: Descriptor, opts: MinimalResolveOptions): Promise<Descriptor[]> {
    return await this.prepareNext('getResolutionDependencies', this.modules[0], descriptor, opts)();
  }
  async getCandidates(descriptor: Descriptor, dependencies: Map<DescriptorHash, Package>, opts: ResolveOptions): Promise<Locator[]> {
    return await this.prepareNext('getCandidates', this.modules[0], descriptor, dependencies, opts)();
  }
  async resolve(locator: Locator, opts: ResolveOptions): Promise<Package> {
    return await this.prepareNext('resolve', this.modules[0], locator, opts)();
  }
}

export class FetcherController implements Fetcher {
  public readonly type = 'module';
  private readonly index = new Map<Fetcher, Fetcher | undefined>();
  private readonly protocols = new MultiFetcher([]);
  private readonly modules = new Array<Fetcher>();

  constructor(fetchers: Array<Fetcher>) {
    fetchers.forEach( (fetcher) => {
      if (fetcher && fetcher.type === 'module') {
        this.modules.push(fetcher);
      } else if (fetcher) {
        this.protocols.addFetcher(fetcher);
      }
    } );
    for (let i=0; i < this.modules.length; i++) {
      this.index.set(this.modules[i], this.modules[i+1]);
    }
  }

  prepareNext(func: string, fetcher: Fetcher | undefined, ...args: any): any {
    if (fetcher) {
      const next = this.index.get(fetcher);
      return (fetcher as any)[func].bind(fetcher, ...args, this.prepareNext(func, next, ...args), this.protocols);
    } else {
      return (this.protocols as any)[func].bind(this.protocols, ...args);
    }
  }

  async supports(locator: Locator, opts: import("./Fetcher").MinimalFetchOptions): Promise<boolean> {
    return await this.prepareNext('supports', this.modules[0], location, opts)();
  }
  async getLocalPath(locator: Locator, opts: import("./Fetcher").FetchOptions) {
    return await this.prepareNext('getLocalPath', this.modules[0], locator, opts)();
  }
  async fetch(locator: Locator, opts: import("./Fetcher").FetchOptions): Promise<import("./Fetcher").FetchResult> {
    return await this.prepareNext('fetch', this.modules[0], locator, opts)();
  }
}
