import {Descriptor, Locator, MinimalResolveOptions, ResolveOptions, Resolver, DescriptorHash, Package} from '@yarnpkg/core';
import {structUtils}                                                                                   from '@yarnpkg/core';

import {PROTOCOL}                                                                                      from './constants';

export class NpmRemapResolver implements Resolver {
  supportsDescriptor(descriptor: Descriptor, opts: MinimalResolveOptions) {
    if (!descriptor.range.startsWith(PROTOCOL))
      return false;

    if (!structUtils.tryParseDescriptor(descriptor.range.slice(PROTOCOL.length), true))
      return false;

    return true;
  }

  supportsLocator(locator: Locator, opts: MinimalResolveOptions) {
    // Once transformed into locators, the descriptors are resolved by the NpmSemverResolver
    return false;
  }

  shouldPersistResolution(locator: Locator, opts: MinimalResolveOptions): never {
    // Once transformed into locators, the descriptors are resolved by the NpmSemverResolver
    throw new Error(`Unreachable`);
  }

  bindDescriptor(descriptor: Descriptor, fromLocator: Locator, opts: MinimalResolveOptions) {
    return descriptor;
  }

  getResolutionDependencies(descriptor: Descriptor, opts: MinimalResolveOptions) {
    const nextDescriptor = structUtils.parseDescriptor(descriptor.range.slice(PROTOCOL.length), true);

    return opts.resolver.getResolutionDependencies(nextDescriptor, opts);
  }

  async getCandidates(descriptor: Descriptor, dependencies: Map<DescriptorHash, Package>, opts: ResolveOptions) {
    const nextDescriptor = structUtils.parseDescriptor(descriptor.range.slice(PROTOCOL.length), true);

    return await opts.resolver.getCandidates(nextDescriptor, dependencies, opts);
  }

  resolve(locator: Locator, opts: ResolveOptions): never {
    // Once transformed into locators, the descriptors are resolved by the NpmSemverResolver
    throw new Error(`Unreachable`);
  }
}
