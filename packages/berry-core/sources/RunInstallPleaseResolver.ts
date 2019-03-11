import {MessageName, ReportError}                        from './Report';
import {Resolver, ResolveOptions, MinimalResolveOptions} from './Resolver';
import {Descriptor, Locator}                             from './types';

export class RunInstallPleaseResolver implements Resolver {
  private readonly resolver: Resolver;

  constructor(resolver: Resolver) {
    this.resolver = resolver;
  }

  supportsDescriptor(descriptor: Descriptor, opts: MinimalResolveOptions) {
    return this.resolver.supportsDescriptor(descriptor, opts);
  }

  supportsLocator(locator: Locator, opts: MinimalResolveOptions) {
    return this.resolver.supportsLocator(locator, opts);
  }

  shouldPersistResolution(locator: Locator, opts: MinimalResolveOptions): never {
    throw new Error(`Unreachable`);
  }

  bindDescriptor(descriptor: Descriptor, fromLocator: Locator, opts: MinimalResolveOptions): never {
    throw new ReportError(MessageName.MISSING_LOCKFILE_ENTRY, `A dependency cannot be retrieved from the lockfile; try to make an install to update your resolutions`);
  }

  async getCandidates(descriptor: Descriptor, opts: ResolveOptions): Promise<never> {
    throw new ReportError(MessageName.MISSING_LOCKFILE_ENTRY, `This package doesn't seem to be present in your lockfile; try to make an install to update your resolutions`);
  }

  async resolve(locator: Locator, opts: ResolveOptions): Promise<never> {
    throw new Error(`Unreachable`);
  }
}
