import semver                                            from 'semver';

import {Resolver, ResolveOptions, MinimalResolveOptions} from './Resolver';
import * as structUtils                                  from './structUtils';
import {Descriptor, Locator}                             from './types';

export class SemverResolver implements Resolver {
  supportsDescriptor(descriptor: Descriptor, opts: MinimalResolveOptions) {
    if (!semver.validRange(descriptor.range))
      return false;

    return true;
  }

  supportsLocator(locator: Locator, opts: MinimalResolveOptions) {
    if (!semver.valid(locator.reference))
      return false;

    return true;
  }

  shouldPersistResolution(locator: Locator, opts: MinimalResolveOptions) {
    return opts.resolver.shouldPersistResolution(this.forwardLocator(locator, opts), opts);
  }

  bindDescriptor(descriptor: Descriptor, fromLocator: Locator, opts: MinimalResolveOptions) {
    return opts.resolver.bindDescriptor(this.forwardDescriptor(descriptor, opts), fromLocator, opts);
  }

  async getCandidates(descriptor: Descriptor, opts: ResolveOptions) {
    return await opts.resolver.getCandidates(this.forwardDescriptor(descriptor, opts), opts);
  }

  async resolve(locator: Locator, opts: ResolveOptions) {
    const pkg = await opts.resolver.resolve(this.forwardLocator(locator, opts), opts);

    return structUtils.renamePackage(pkg, locator);
  }

  private forwardDescriptor(descriptor: Descriptor, opts: MinimalResolveOptions) {
    return structUtils.makeDescriptor(descriptor, `${opts.project.configuration.get(`defaultProtocol`)}${descriptor.range}`);
  }

  private forwardLocator(locator: Locator, opts: MinimalResolveOptions) {
    return structUtils.makeLocator(locator, `${opts.project.configuration.get(`defaultProtocol`)}${locator.reference}`);
  }
}
