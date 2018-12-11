import {Resolver, ResolveOptions, MinimalResolveOptions} from '@berry/core';
import {Descriptor, Locator, Manifest}                   from '@berry/core';
import {LinkType}                                        from '@berry/core';

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

  shouldPersistResolution(locator: Locator, opts: MinimalResolveOptions) {
    return true;
  }

  async normalizeDescriptor(descriptor: Descriptor, fromLocator: Locator, opts: MinimalResolveOptions) {
    return descriptor;
  }

  async getCandidates(descriptor: Descriptor, opts: ResolveOptions) {
    return [descriptor.range];
  }

  async resolve(locator: Locator, opts: ResolveOptions) {
    const [baseFs, release] = await opts.fetcher.fetch(locator, opts);

    try {
      const manifest = await Manifest.fromFile(`package.json`, {baseFs});

      const languageName = opts.project.configuration.defaultLanguageName;
      const linkType = LinkType.HARD;

      const dependencies = manifest.dependencies;
      const peerDependencies = manifest.peerDependencies;

      return {... locator, languageName, linkType, dependencies, peerDependencies};
    } finally {
      await release();
    }
  }
}
