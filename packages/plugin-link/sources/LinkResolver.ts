import {Resolver, ResolveOptions, MinimalResolveOptions} from '@berry/core';
import {Descriptor, Locator, Manifest}                   from '@berry/core';
import {LinkType}                                        from '@berry/core';
import {structUtils}                                     from '@berry/core';
import {posix}                                           from 'path';
import querystring                                       from 'querystring';

import {LINK_PROTOCOL}                                   from './constants';

export class LinkResolver implements Resolver {
  supportsDescriptor(descriptor: Descriptor, opts: MinimalResolveOptions) {
    if (!descriptor.range.startsWith(LINK_PROTOCOL))
      return false;

    return true;
  }

  supportsLocator(locator: Locator, opts: MinimalResolveOptions) {
    if (!locator.reference.startsWith(LINK_PROTOCOL))
      return false;

    return true;
  }

  shouldPersistResolution(locator: Locator, opts: MinimalResolveOptions) {
    return false;
  }

  bindDescriptor(descriptor: Descriptor, fromLocator: Locator, opts: MinimalResolveOptions) {
    if (descriptor.range.includes(`?`))
      throw new Error(`Link-type dependencies cannot contain the character "?"`);

    return structUtils.makeDescriptor(descriptor, `${descriptor.range}?${querystring.stringify({
      locator: structUtils.stringifyLocator(fromLocator),
    })}`);
  }

  async getCandidates(descriptor: Descriptor, opts: ResolveOptions) {
    return [structUtils.convertDescriptorToLocator(descriptor)];
  }

  async resolve(locator: Locator, opts: ResolveOptions) {
    const packageFetch = await opts.fetcher.fetch(locator, opts);

    const manifest = await Manifest.fromFile(posix.resolve(packageFetch.prefixPath, `package.json`), {baseFs: packageFetch.packageFs});

    const languageName = opts.project.configuration.defaultLanguageName;
    const linkType = LinkType.SOFT;

    const dependencies = manifest.dependencies;
    const peerDependencies = manifest.peerDependencies;

    return {... locator, languageName, linkType, dependencies, peerDependencies};
  }
}
