import {Resolver, ResolveOptions, MinimalResolveOptions} from '@yarnpkg/core';
import {Descriptor, Locator, Manifest}                   from '@yarnpkg/core';
import {LinkType}                                        from '@yarnpkg/core';
import {miscUtils, structUtils}                          from '@yarnpkg/core';
import {NodeFS}                                          from '@yarnpkg/fslib';

import {FILE_REGEXP, PROTOCOL}                           from './constants';

export class FileResolver implements Resolver {
  supportsDescriptor(descriptor: Descriptor, opts: MinimalResolveOptions) {
    if (descriptor.range.match(FILE_REGEXP))
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

  bindDescriptor(descriptor: Descriptor, fromLocator: Locator, opts: MinimalResolveOptions) {
    if (FILE_REGEXP.test(descriptor.range))
      descriptor = structUtils.makeDescriptor(descriptor, `file:${descriptor.range}`);

    return structUtils.bindDescriptor(descriptor, {
      locator: structUtils.stringifyLocator(fromLocator),
    });
  }

  async getCandidates(descriptor: Descriptor, opts: ResolveOptions) {
    let path = descriptor.range;

    if (path.startsWith(PROTOCOL))
      path = path.slice(PROTOCOL.length);

    return [structUtils.makeLocator(descriptor, `${PROTOCOL}${NodeFS.toPortablePath(path)}`)];
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
