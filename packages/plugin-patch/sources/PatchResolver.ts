import {Resolver, ResolveOptions, MinimalResolveOptions} from '@yarnpkg/core';
import {Descriptor, Locator, Package}                    from '@yarnpkg/core';
import {structUtils}                                     from '@yarnpkg/core';

import * as patchUtils                                   from './patchUtils';

export class PatchResolver implements Resolver {
  supportsDescriptor(descriptor: Descriptor, opts: MinimalResolveOptions) {
    if (!patchUtils.isPatchDescriptor(descriptor))
      return false;

    return true;
  }

  supportsLocator(locator: Locator, opts: MinimalResolveOptions) {
    if (!patchUtils.isPatchLocator(locator))
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

    return {
      sourceDescriptor: opts.project.configuration.normalizeDependency(sourceDescriptor),
    };
  }

  async getCandidates(descriptor: Descriptor, dependencies: Record<string, Package>, opts: ResolveOptions) {
    if (!opts.fetchOptions)
      throw new Error(`Assertion failed: This resolver cannot be used unless a fetcher is configured`);

    const {parentLocator, patchPaths} = patchUtils.parseDescriptor(descriptor);
    const patchFiles = await patchUtils.loadPatchFiles(parentLocator, patchPaths, opts.fetchOptions);

    const sourcePackage = dependencies.sourceDescriptor;
    if (typeof sourcePackage === `undefined`)
      throw new Error(`Assertion failed: The dependency should have been resolved`);

    const patchHash = patchUtils.makePatchHash(patchFiles, sourcePackage.version);

    return [patchUtils.makeLocator(descriptor, {parentLocator, sourcePackage, patchPaths, patchHash})];
  }

  async getSatisfying(descriptor: Descriptor, dependencies: Record<string, Package>, locators: Array<Locator>, opts: ResolveOptions) {
    const [locator] = await this.getCandidates(descriptor, dependencies, opts);

    return {
      locators: locators.filter(candidate => candidate.locatorHash === locator.locatorHash),
      sorted: false,
    };
  }

  async resolve(locator: Locator, opts: ResolveOptions): Promise<Package> {
    const {sourceLocator} = patchUtils.parseLocator(locator);
    const sourcePkg = await opts.resolver.resolve(sourceLocator, opts);

    return {...sourcePkg, ...locator};
  }
}
