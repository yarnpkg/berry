import {Resolver, ResolveOptions, MinimalResolveOptions} from './Resolver';
import * as structUtils                                  from './structUtils';
import {Descriptor, Locator}                             from './types';

export class AliasResolver implements Resolver {
  private next: Resolver;

  constructor(next: Resolver) {
    this.next = next;
  }

  supportsDescriptor(descriptor: Descriptor, opts: MinimalResolveOptions) {
    return this.next.supportsDescriptor(descriptor, opts);
  }

  supportsLocator(locator: Locator, opts: MinimalResolveOptions) {
    return this.next.supportsLocator(locator, opts);
  }

  shouldPersistResolution(locator: Locator, opts: MinimalResolveOptions) {
    return this.next.shouldPersistResolution(locator, opts);
  }

  bindDescriptor(descriptor: Descriptor, fromLocator: Locator, opts: MinimalResolveOptions) {
    return this.next.bindDescriptor(descriptor, fromLocator, opts);
  }

  async getCandidates(descriptor: Descriptor, opts: ResolveOptions) {
    return await this.next.getCandidates(descriptor, opts);
  }

  async resolve(locator: Locator, opts: ResolveOptions) {
    const pkg = await this.next.resolve(locator, opts);
    const topLevelWorkspace = opts.project.topLevelWorkspace;

    for (const descriptor of Array.from(pkg.dependencies.values())) {
      for (const {pattern, reference} of topLevelWorkspace.manifest.resolutions) {
        if (pattern.from && pattern.from.fullName !== structUtils.requirableIdent(locator))
          continue;
        if (pattern.from && pattern.from.description && pattern.from.description !== locator.reference)
          continue;

        if (pattern.descriptor.fullName !== structUtils.requirableIdent(descriptor))
          continue;        
        if (pattern.descriptor.description && pattern.descriptor.description !== descriptor.range)
          continue;

        const alias = opts.resolver.bindDescriptor(
          structUtils.makeDescriptor(descriptor, reference),
          topLevelWorkspace.anchoredLocator,
          opts,
        );
        
        pkg.dependencies.delete(descriptor.identHash);
        pkg.dependencies.set(alias.identHash, alias);
      }
    }

    return pkg;
  }
}
