import {Descriptor, Locator, MinimalResolveOptions, ResolveOptions, Resolver, Package} from '@yarnpkg/core';
import {structUtils}                                                                   from '@yarnpkg/core';

import {PROTOCOL}                                                                      from './constants';

export class NpmTarballResolver implements Resolver {
  supportsDescriptor(descriptor: Descriptor, opts: MinimalResolveOptions) {
    if (!descriptor.range.startsWith(PROTOCOL))
      return false;

    const {params} = structUtils.parseRange(descriptor.range);
    if (params === null || typeof params.__archiveUrl !== `string`)
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
    return {};
  }

  async getCandidates(descriptor: Descriptor, dependencies: Record<string, Package>, opts: ResolveOptions) {
    return [structUtils.convertDescriptorToLocator(descriptor)];
  }

  async getSatisfying(descriptor: Descriptor, dependencies: Record<string, Package>, locators: Array<Locator>, opts: ResolveOptions) {
    const baseLocator = structUtils.convertDescriptorToLocator(descriptor);
    return {locators: locators.filter(locator => structUtils.areLocatorsEqual(locator, baseLocator)), sorted: false};
  }

  resolve(locator: Locator, opts: ResolveOptions): never {
    // Once transformed into locators, the descriptors are resolved by the NpmSemverResolver
    throw new Error(`Unreachable`);
  }
}
