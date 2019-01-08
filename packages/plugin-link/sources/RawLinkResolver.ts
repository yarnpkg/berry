import {Resolver, ResolveOptions, MinimalResolveOptions} from '@berry/core';
import {Descriptor, Locator}                             from '@berry/core';
import {LinkType}                                        from '@berry/core';
import {structUtils}                                     from '@berry/core';
import querystring                                       from 'querystring';

import {RAW_LINK_PROTOCOL}                               from './constants';

export class RawLinkResolver implements Resolver {
  supportsDescriptor(descriptor: Descriptor, opts: MinimalResolveOptions) {
    if (!descriptor.range.startsWith(RAW_LINK_PROTOCOL))
      return false;

    return true;
  }

  supportsLocator(locator: Locator, opts: MinimalResolveOptions) {
    if (!locator.reference.startsWith(RAW_LINK_PROTOCOL))
      return false;

    return true;
  }

  shouldPersistResolution(locator: Locator, opts: MinimalResolveOptions) {
    return false;
  }

  normalizeDescriptor(descriptor: Descriptor, fromLocator: Locator, opts: MinimalResolveOptions) {
    if (descriptor.range.includes(`?`))
      throw new Error(`Link-type dependencies cannot contain the character "?"`);

    return structUtils.makeDescriptor(descriptor, `${descriptor.range}?${querystring.stringify({
      locator: structUtils.stringifyLocator(fromLocator),
    })}`);
  }

  async getCandidates(descriptor: Descriptor, opts: ResolveOptions) {
    return [descriptor.range];
  }

  async resolve(locator: Locator, opts: ResolveOptions) {
    const languageName = opts.project.configuration.defaultLanguageName;
    const linkType = LinkType.SOFT;

    const dependencies = new Map();
    const peerDependencies = new Map();

    return {... locator, languageName, linkType, dependencies, peerDependencies};
  }
}
