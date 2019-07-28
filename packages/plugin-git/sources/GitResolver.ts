import {Resolver, ResolveOptions, MinimalResolveOptions} from '@berry/core';
import {structUtils}                                     from '@berry/core';
import {Descriptor, Locator, Manifest}                   from '@berry/core';

import {GIT_REGEXP}                                      from './constants';

export class GitResolver implements Resolver {
  supportsDescriptor(descriptor: Descriptor, opts: MinimalResolveOptions) {
    return descriptor.range.match(GIT_REGEXP);
  }

  supportsLocator(locator: Locator, opts: MinimalResolveOptions) {
    return locator.reference.match(GIT_REGEXP);
  }

  shouldPersistResolution(locator: Locator, opts: MinimalResolveOptions) {
    return true;
  }

  bindDescriptor(descriptor: Descriptor, fromLocator: Locator, opts: MinimalResolveOptions) {
    return descriptor;
  }

  async getCandidates(descriptor: Descriptor, opts: ResolveOptions) {
    return [structUtils.convertDescriptorToLocator(descriptor)];
  }

  async resolve(locator: Locator, opts: ResolveOptions) {
    // Requires fetcher implementation
  }
}
