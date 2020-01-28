import {Resolver, ResolveOptions, MinimalResolveOptions} from './Resolver';
import {Descriptor, Locator}                             from './types';

export class VirtualResolver implements Resolver {
  type = 'protocol';
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

  async supportsDescriptor(descriptor: Descriptor, opts: MinimalResolveOptions) {
    return VirtualResolver.isVirtualDescriptor(descriptor);
  }

  async supportsLocator(locator: Locator, opts: MinimalResolveOptions) {
    return VirtualResolver.isVirtualLocator(locator);
  }

  async shouldPersistResolution(locator: Locator, opts: MinimalResolveOptions) {
    return false;
  }

  async bindDescriptor(descriptor: Descriptor, locator: Locator, opts: MinimalResolveOptions): never {
    // It's unsupported because packages inside the dependency tree should
    // only become virtual AFTER they have all been resolved, by which point
    // you shouldn't need to call `bindDescriptor` anymore.

    throw new Error(`Assertion failed: calling "bindDescriptor" on a virtual descriptor is unsupported`);
  }

  async getResolutionDependencies(descriptor: Descriptor, opts: MinimalResolveOptions): never {
    // It's unsupported because packages inside the dependency tree should
    // only become virtual AFTER they have all been resolved, by which point
    // you shouldn't need to call `bindDescriptor` anymore.

    throw new Error(`Assertion failed: calling "getResolutionDependencies" on a virtual descriptor is unsupported`);
  }

  async getCandidates(descriptor: Descriptor, dependencies: unknown, opts: ResolveOptions): Promise<never> {
    // It's unsupported because packages inside the dependency tree should
    // only become virtual AFTER they have all been resolved, by which point
    // you shouldn't need to call `getCandidates` anymore.

    throw new Error(`Assertion failed: calling "getCandidates" on a virtual descriptor is unsupported`);
  }

  async resolve(locator: Locator, opts: ResolveOptions): Promise<never> {
    // It's unsupported because packages inside the dependency tree should
    // only become virtual AFTER they have all been resolved, by which point
    // you shouldn't need to call `resolve` anymore.

    throw new Error(`Assertion failed: calling "resolve" on a virtual locator is unsupported`);
  }
}
