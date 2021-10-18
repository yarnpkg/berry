import {Resolver, ResolveOptions, MinimalResolveOptions}        from '@yarnpkg/core';
import {Descriptor, Locator, Manifest, DescriptorHash, Package} from '@yarnpkg/core';
import {LinkType}                                               from '@yarnpkg/core';
import {miscUtils, structUtils, hashUtils}                      from '@yarnpkg/core';

import {PROTOCOL}                                               from './constants';
import * as execUtils                                           from './execUtils';

// We use this for the generators to be regenerated without bumping the whole cache
const CACHE_VERSION = 2;

export class ExecResolver implements Resolver {
  supportsDescriptor(descriptor: Descriptor, opts: MinimalResolveOptions) {
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
    return structUtils.bindDescriptor(descriptor, {
      locator: structUtils.stringifyLocator(fromLocator),
    });
  }

  getResolutionDependencies(descriptor: Descriptor, opts: MinimalResolveOptions) {
    return [];
  }

  async getCandidates(descriptor: Descriptor, dependencies: Map<DescriptorHash, Package>, opts: ResolveOptions) {
    if (!opts.fetchOptions)
      throw new Error(`Assertion failed: This resolver cannot be used unless a fetcher is configured`);

    const {path, parentLocator} = execUtils.parseSpec(descriptor.range);

    if (parentLocator === null)
      throw new Error(`Assertion failed: The descriptor should have been bound`);

    const generatorFile = await execUtils.loadGeneratorFile(structUtils.makeRange({
      protocol: PROTOCOL,
      source: path,
      selector: path,
      params: {
        locator: structUtils.stringifyLocator(parentLocator),
      },
    }), PROTOCOL, opts.fetchOptions);
    const generatorHash = hashUtils.makeHash(`${CACHE_VERSION}`, generatorFile).slice(0, 6);

    return [execUtils.makeLocator(descriptor, {parentLocator, path, generatorHash, protocol: PROTOCOL})];
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
