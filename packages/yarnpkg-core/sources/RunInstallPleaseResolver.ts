import {MessageName}                                     from './MessageName';
import {ReportError}                                     from './Report';
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

  shouldPersistResolution(locator: Locator, opts: MinimalResolveOptions) {
    return this.resolver.shouldPersistResolution(locator, opts);
  }

  bindDescriptor(descriptor: Descriptor, fromLocator: Locator, opts: MinimalResolveOptions) {
    return this.resolver.bindDescriptor(descriptor, fromLocator, opts);
  }

  getResolutionDependencies(descriptor: Descriptor, opts: MinimalResolveOptions) {
    return this.resolver.getResolutionDependencies(descriptor, opts);
  }

  async getCandidates(descriptor: Descriptor, dependencies: unknown, opts: ResolveOptions): Promise<never> {
    throw new ReportError(MessageName.MISSING_LOCKFILE_ENTRY, `This package doesn't seem to be present in your lockfile; run "yarn install" to update the lockfile`);
  }

  async getSatisfying(descriptor: Descriptor, references: Array<string>, opts: ResolveOptions): Promise<never> {
    throw new ReportError(MessageName.MISSING_LOCKFILE_ENTRY, `This package doesn't seem to be present in your lockfile; run "yarn install" to update the lockfile`);
  }

  async resolve(locator: Locator, opts: ResolveOptions): Promise<never> {
    throw new ReportError(MessageName.MISSING_LOCKFILE_ENTRY, `This package doesn't seem to be present in your lockfile; run "yarn install" to update the lockfile`);
  }
}
