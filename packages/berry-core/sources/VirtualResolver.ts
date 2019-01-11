import {Resolver, ResolveOptions, MinimalResolveOptions} from './Resolver';
import * as structUtils                                  from './structUtils';
import {Descriptor, Locator}                             from './types';

export class VirtualResolver implements Resolver {
  static protocol = `virtual:`;

  static isVirtualDescriptor(descriptor: Descriptor) {
    if (!descriptor.range.startsWith(VirtualResolver.protocol))
      return false;

    return true;
  }

  static isVirtualLocator(locator: Locator) {
    if (!locator.reference.startsWith(VirtualResolver.protocol))
      return false;

    return true;
  }

  supportsDescriptor(descriptor: Descriptor, opts: MinimalResolveOptions) {
    return VirtualResolver.isVirtualDescriptor(descriptor);
  }

  supportsLocator(locator: Locator, opts: MinimalResolveOptions) {
    return VirtualResolver.isVirtualLocator(locator);
  }

  shouldPersistResolution(locator: Locator, opts: MinimalResolveOptions) {
    return false;
  }

  bindDescriptor(descriptor: Descriptor, locator: Locator, opts: MinimalResolveOptions) {
    return descriptor;
  }

  async getCandidates(descriptor: Descriptor, opts: ResolveOptions) {
    return [structUtils.convertDescriptorToLocator(descriptor)];
  }

  async resolve(locator: Locator, opts: ResolveOptions): Promise<never> {
    // It's unsupported because packages inside the dependency tree should
    // only become virtual AFTER they have all been resolved, by which point
    // you shouldn't need to call `resolve` anymore.

    throw new Error(`Calling "resolve" on the virtual resolver is unsupported`);
  }
}
