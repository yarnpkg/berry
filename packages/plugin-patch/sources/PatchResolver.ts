import {Resolver, ResolveOptions, MinimalResolveOptions, DescriptorHash, hashUtils} from '@yarnpkg/core';
import {Descriptor, Locator, Package}                                               from '@yarnpkg/core';
import {structUtils}                                                                from '@yarnpkg/core';

import * as patchUtils                                                              from './patchUtils';

export class PatchResolver implements Resolver {
  supportsDescriptor(descriptor: Descriptor, opts: MinimalResolveOptions) {
    if (!descriptor.range.startsWith(`patch:`))
      return false;

    return true;
  }

  supportsLocator(locator: Locator, opts: MinimalResolveOptions) {
    if (!locator.reference.startsWith(`patch:`))
      return false;

    return true;
  }

  shouldPersistResolution(locator: Locator, opts: MinimalResolveOptions) {
    return false;
  }

  bindDescriptor(descriptor: Descriptor, fromLocator: Locator, opts: MinimalResolveOptions) {
    // If the patch is statically defined (ie absolute or a builtin), then we
    // don't need to bind the descriptor to its parent
    const {patchPaths} = patchUtils.parseDescriptor(descriptor);
    if (patchPaths.every(patchPath => !patchUtils.isParentRequired(patchPath)))
      return descriptor;

    return structUtils.bindDescriptor(descriptor, {
      locator: structUtils.stringifyLocator(fromLocator),
    });
  }

  getResolutionDependencies(descriptor: Descriptor, opts: MinimalResolveOptions) {
    const {sourceDescriptor} = patchUtils.parseDescriptor(descriptor);

    return [sourceDescriptor];
  }

  async getCandidates(descriptor: Descriptor, dependencies: Map<DescriptorHash, Locator>, opts: ResolveOptions) {
    if (!opts.fetchOptions)
      throw new Error(`Assertion failed: This resolver cannot be used unless a fetcher is configured`);

    const {parentLocator, sourceDescriptor, patchPaths} = patchUtils.parseDescriptor(descriptor);
    const patchFiles = await patchUtils.loadPatchFiles(parentLocator, patchPaths, opts.fetchOptions);

    const sourceLocator = dependencies.get(sourceDescriptor.descriptorHash);
    if (typeof sourceLocator === `undefined`)
      throw new Error(`Assertion failed: The dependency should have been resolved`);

    const patchHash = hashUtils.makeHash(...patchFiles).slice(0, 6);

    return [patchUtils.makeLocator(descriptor, {parentLocator, sourceLocator, patchPaths, patchHash})];
  }

  async resolve(locator: Locator, opts: ResolveOptions): Promise<Package> {
    const {sourceLocator} = patchUtils.parseLocator(locator);
    const sourcePkg = await opts.resolver.resolve(sourceLocator, opts);

    return {...sourcePkg, ...locator};
  }
}
