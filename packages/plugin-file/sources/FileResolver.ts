import querystring = require('querystring');

import {Resolver, ResolveOptions, MinimalResolveOptions} from '@berry/core';
import {Descriptor, Locator, Manifest}                   from '@berry/core';
import {structUtils}                                     from '@berry/core';

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

  async normalizeDescriptor(descriptor: Descriptor, fromLocator: Locator, opts: MinimalResolveOptions) {
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
    const pkgFs = await opts.fetcher.fetch(locator, opts);

    const manifest = new Manifest();
    manifest.loadFile(pkgFs);

    const binaries = manifest.bin;
    const dependencies = manifest.dependencies;
    const peerDependencies = manifest.peerDependencies;

    return {... locator, binaries, dependencies, peerDependencies};
  }
}
