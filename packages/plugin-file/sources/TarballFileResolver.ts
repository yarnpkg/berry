import {Resolver, ResolveOptions, MinimalResolveOptions} from '@yarnpkg/core';
import {Descriptor, Locator, Manifest}                   from '@yarnpkg/core';
import {LinkType}                                        from '@yarnpkg/core';
import {miscUtils, structUtils}                          from '@yarnpkg/core';
import {npath}                                           from '@yarnpkg/fslib';
import querystring                                       from 'querystring';

import {FILE_REGEXP, TARBALL_REGEXP, PROTOCOL}           from './constants';

export class TarballFileResolver implements Resolver {
  supportsDescriptor(descriptor: Descriptor, opts: MinimalResolveOptions) {
    if (!TARBALL_REGEXP.test(descriptor.range))
      return false;

    if (descriptor.range.startsWith(PROTOCOL))
      return true;

    if (FILE_REGEXP.test(descriptor.range))
      return true;

    return false;
  }

  supportsLocator(locator: Locator, opts: MinimalResolveOptions) {
    if (!TARBALL_REGEXP.test(locator.reference))
      return false;

    if (locator.reference.startsWith(PROTOCOL))
      return true;

    return false;
  }

  shouldPersistResolution(locator: Locator, opts: MinimalResolveOptions) {
    return true;
  }

  bindDescriptor(descriptor: Descriptor, fromLocator: Locator, opts: MinimalResolveOptions) {
    if (FILE_REGEXP.test(descriptor.range))
      descriptor = structUtils.makeDescriptor(descriptor, `file:${descriptor.range}`);

    if (descriptor.range.includes(`?`))
      return descriptor;

    return structUtils.makeDescriptor(descriptor, `${descriptor.range}?${querystring.stringify({
      locator: structUtils.stringifyLocator(fromLocator),
    })}`);
  }

  async getCandidates(descriptor: Descriptor, opts: ResolveOptions) {
    let path = descriptor.range;

    if (path.startsWith(PROTOCOL))
      path = path.slice(PROTOCOL.length);

    return [structUtils.makeLocator(descriptor, `${PROTOCOL}${npath.toPortablePath(path)}`)];
  }

  async resolve(locator: Locator, opts: ResolveOptions) {
    const packageFetch = await opts.fetcher.fetch(locator, opts);

    const manifest = await miscUtils.releaseAfterUseAsync(async () => {
      return await Manifest.find(packageFetch.prefixPath, {baseFs: packageFetch.packageFs});
    }, packageFetch.releaseFs);

    return {
      ...locator,

      version: manifest.version || `0.0.0`,

      languageName: opts.project.configuration.get(`defaultLanguageName`),
      linkType: LinkType.HARD,

      dependencies: manifest.dependencies,
      peerDependencies: manifest.peerDependencies,

      dependenciesMeta: manifest.dependenciesMeta,
      peerDependenciesMeta: manifest.peerDependenciesMeta,

      bin: manifest.bin,
    };
  }
}
