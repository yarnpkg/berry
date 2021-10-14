import {Resolver, ResolveOptions, MinimalResolveOptions} from './Resolver';
import * as structUtils                                  from './structUtils';
import {Descriptor, Locator}                             from './types';

export class LockfileResolver implements Resolver {
  private readonly resolver: Resolver;

  constructor(resolver: Resolver) {
    this.resolver = resolver;
  }

  supportsDescriptor(descriptor: Descriptor, opts: MinimalResolveOptions) {
    const resolution = opts.project.storedResolutions.get(descriptor.descriptorHash);
    if (resolution)
      return true;

    // If the descriptor matches a package that's already been used, we can just use it even if we never resolved the range before
    // Ex: foo depends on bar@^1.0.0 that we resolved to foo@1.1.0, then we add a package qux that depends on foo@1.1.0 (without the caret)
    if (opts.project.originalPackages.has(structUtils.convertDescriptorToLocator(descriptor).locatorHash))
      return true;

    return false;
  }

  supportsLocator(locator: Locator, opts: MinimalResolveOptions) {
    if (opts.project.originalPackages.has(locator.locatorHash) && !opts.project.lockfileNeedsRefresh)
      return true;

    return false;
  }

  shouldPersistResolution(locator: Locator, opts: MinimalResolveOptions): boolean {
    throw new Error(`The shouldPersistResolution method shouldn't be called on the lockfile resolver, which would always answer yes`);
  }

  bindDescriptor(descriptor: Descriptor, fromLocator: Locator, opts: MinimalResolveOptions) {
    return descriptor;
  }

  getResolutionDependencies(descriptor: Descriptor, opts: MinimalResolveOptions) {
    return this.resolver.getResolutionDependencies(descriptor, opts);
  }

  async getCandidates(descriptor: Descriptor, dependencies: unknown, opts: ResolveOptions) {
    let pkg = opts.project.originalPackages.get(structUtils.convertDescriptorToLocator(descriptor).locatorHash);
    if (pkg)
      return [pkg];

    const resolution = opts.project.storedResolutions.get(descriptor.descriptorHash);
    if (!resolution)
      throw new Error(`Expected the resolution to have been successful - resolution not found`);

    pkg = opts.project.originalPackages.get(resolution);
    if (!pkg)
      throw new Error(`Expected the resolution to have been successful - package not found`);

    return [pkg];
  }

  async getSatisfying(descriptor: Descriptor, references: Array<string>, opts: ResolveOptions) {
    return null;
  }

  async resolve(locator: Locator, opts: ResolveOptions) {
    const pkg = opts.project.originalPackages.get(locator.locatorHash);
    if (!pkg)
      throw new Error(`The lockfile resolver isn't meant to resolve packages - they should already have been stored into a cache`);

    return pkg;
  }
}
