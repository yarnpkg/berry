import {Resolver, ResolveOptions} from './Resolver';
import * as structUtils           from './structUtils';
import {Descriptor, Locator}      from './types';

export class LockfileResolver implements Resolver {
  supports(descriptor: Descriptor, opts: ResolveOptions) {
    if (opts.project.storedResolutions.has(descriptor.descriptorHash))
      return true;

    if (opts.project.storedPackages.has(structUtils.convertDescriptorToLocator(descriptor).locatorHash))
      return true;

    return false;
  }

  async getCandidates(descriptor: Descriptor, opts: ResolveOptions) {
    let pkg = opts.project.storedPackages.get(structUtils.convertDescriptorToLocator(descriptor).locatorHash);

    if (pkg)
      return [pkg.reference];

    const resolution = opts.project.storedResolutions.get(descriptor.descriptorHash);

    if (!resolution)
      throw new Error(`Expected the resolution to have been successful - resolution not found`);

    pkg = opts.project.storedPackages.get(resolution);

    if (!pkg)
      throw new Error(`Expected the resolution to have been successful - package not found`);

    return [pkg.reference];
  }

  async resolve(locator: Locator, opts: ResolveOptions) {
    const pkg = opts.project.storedPackages.get(locator.locatorHash);

    if (!pkg)
      throw new Error(`The lockfile resolver isn't meant to resolve packages - they should already have been stored into a cache`);

    return pkg;
  }
}
