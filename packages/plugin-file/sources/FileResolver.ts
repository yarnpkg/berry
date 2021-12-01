import {miscUtils, structUtils, hashUtils}               from '@yarnpkg/core';
import {LinkType}                                        from '@yarnpkg/core';
import {Descriptor, Locator, Manifest}                   from '@yarnpkg/core';
import {Resolver, ResolveOptions, MinimalResolveOptions} from '@yarnpkg/core';

import {FILE_REGEXP, PROTOCOL}                           from './constants';
import * as fileUtils                                    from './fileUtils';

// We use this for the folders to be regenerated without bumping the whole cache
const CACHE_VERSION = 2;

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
      descriptor = structUtils.makeDescriptor(descriptor, `${PROTOCOL}${descriptor.range}`);

    return structUtils.bindDescriptor(descriptor, {
      locator: structUtils.stringifyLocator(fromLocator),
    });
  }

  getResolutionDependencies(descriptor: Descriptor, opts: MinimalResolveOptions) {
    return [];
  }

  async getCandidates(descriptor: Descriptor, dependencies: unknown, opts: ResolveOptions) {
    if (!opts.fetchOptions)
      throw new Error(`Assertion failed: This resolver cannot be used unless a fetcher is configured`);

    const {path, parentLocator} = fileUtils.parseSpec(descriptor.range);

    if (parentLocator === null)
      throw new Error(`Assertion failed: The descriptor should have been bound`);

    const archiveBuffer = await fileUtils.makeBufferFromLocator(
      structUtils.makeLocator(descriptor,
        structUtils.makeRange({
          protocol: PROTOCOL,
          source: path,
          selector: path,
          params: {
            locator: structUtils.stringifyLocator(parentLocator),
          },
        }),
      ),
      {protocol: PROTOCOL, fetchOptions: opts.fetchOptions},
    );

    const folderHash = hashUtils.makeHash(`${CACHE_VERSION}`, archiveBuffer).slice(0, 6);

    return [fileUtils.makeLocator(descriptor, {parentLocator, path, folderHash, protocol: PROTOCOL})];
  }

  async getSatisfying(descriptor: Descriptor, references: Array<string>, opts: ResolveOptions) {
    return null;
  }

  async resolve(locator: Locator, opts: ResolveOptions) {
    if (!opts.fetchOptions)
      throw new Error(`Assertion failed: This resolver cannot be used unless a fetcher is configured`);

    const packageFetch = await opts.fetchOptions.fetcher.fetch(locator, opts.fetchOptions);

    const manifest = await miscUtils.releaseAfterUseAsync(async () => {
      return await Manifest.find(packageFetch.prefixPath, {baseFs: packageFetch.packageFs});
    }, packageFetch.releaseFs);

    return {
      ...locator,

      version: manifest.version || `0.0.0`,

      languageName: manifest.languageName || opts.project.configuration.get(`defaultLanguageName`),
      linkType: LinkType.HARD,

      conditions: manifest.getConditions(),

      dependencies: manifest.dependencies,
      peerDependencies: manifest.peerDependencies,

      dependenciesMeta: manifest.dependenciesMeta,
      peerDependenciesMeta: manifest.peerDependenciesMeta,

      bin: manifest.bin,
    };
  }
}
