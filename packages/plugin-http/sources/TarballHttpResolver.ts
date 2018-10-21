import {Resolver, ResolveOptions, MinimalResolveOptions} from '@berry/core';
import {Descriptor, Locator, Manifest}                   from '@berry/core';

import {PROTOCOL_REGEXP, TARBALL_REGEXP}                 from './constants';

export class TarballHttpResolver implements Resolver {
  supportsDescriptor(descriptor: Descriptor, opts: MinimalResolveOptions) {
    if (!TARBALL_REGEXP.test(descriptor.range))
      return false;

    if (PROTOCOL_REGEXP.test(descriptor.range))
      return true;

    return false;
  }

  supportsLocator(locator: Locator, opts: MinimalResolveOptions) {
    if (!TARBALL_REGEXP.test(locator.reference))
      return false;

    if (PROTOCOL_REGEXP.test(locator.reference))
      return true;

    return false;
  }

  async normalizeDescriptor(descriptor: Descriptor, fromLocator: Locator, opts: MinimalResolveOptions) {
    return descriptor;
  }

  async getCandidates(descriptor: Descriptor, opts: ResolveOptions) {
    return [descriptor.range];
  }

  async resolve(locator: Locator, opts: ResolveOptions) {
    const pkgFs = await opts.fetcher.fetch(locator, opts);

    const manifest = new Manifest();
    manifest.loadFile(pkgFs);

    const binaries = manifest.bin;
    const dependencies = manifest.dependencies;
    const peerDependencies = manifest.peerDependencies;

    return {... locator, binaries, dependencies, peerDependencies};
  }
}
