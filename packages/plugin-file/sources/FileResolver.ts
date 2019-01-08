import {Resolver, ResolveOptions, MinimalResolveOptions} from '@berry/core';
import {Descriptor, Locator, Manifest}                   from '@berry/core';
import {LinkType}                                        from '@berry/core';
import {structUtils}                                     from '@berry/core';
import querystring                                       from 'querystring';

import {FILE_REGEXP, PROTOCOL}                           from './constants';

export class FileResolver implements Resolver {
  supportsDescriptor(descriptor: Descriptor, opts: MinimalResolveOptions) {
    if (FILE_REGEXP.test(descriptor.range))
      return true;

    if (!descriptor.range.startsWith(PROTOCOL))
      return false;

    return true;
  }

  supportsLocator(locator: Locator, opts: MinimalResolveOptions) {
    if (!locator.reference.startsWith(PROTOCOL))
      return false;

    return true;
  }

  shouldPersistResolution(locator: Locator, opts: MinimalResolveOptions) {
    return false;
  }

  normalizeDescriptor(descriptor: Descriptor, fromLocator: Locator, opts: MinimalResolveOptions) {
    if (FILE_REGEXP.test(descriptor.range))
      descriptor = structUtils.makeDescriptor(descriptor, `file:${descriptor.range}`);

    if (descriptor.range.includes(`?`))
      throw new Error(`File-type dependencies cannot contain the character "?"`);

    return structUtils.makeDescriptor(descriptor, `${descriptor.range}?${querystring.stringify({
      locator: structUtils.stringifyLocator(fromLocator),
    })}`);
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
