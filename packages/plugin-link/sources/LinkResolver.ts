import {Resolver, ResolveOptions, MinimalResolveOptions, DescriptorHash} from '@yarnpkg/core';
import {Descriptor, Locator, Manifest, Package}                          from '@yarnpkg/core';
import {LinkType}                                                        from '@yarnpkg/core';
import {miscUtils, structUtils}                                          from '@yarnpkg/core';
import {npath}                                                           from '@yarnpkg/fslib';

import {LINK_PROTOCOL}                                                   from './constants';

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
    return structUtils.bindDescriptor(descriptor, {
      locator: structUtils.stringifyLocator(fromLocator),
    });
  }

  getResolutionDependencies(descriptor: Descriptor, opts: MinimalResolveOptions) {
    return [];
  }

  async getCandidates(descriptor: Descriptor, dependencies: unknown, opts: ResolveOptions) {
    const locator = await this.getCandidateForDescriptor(descriptor, opts);

    return [locator];
  }

  async getSatisfying(descriptor: Descriptor, references: Array<string>, dependencies: Map<DescriptorHash, Package>, opts: ResolveOptions) {
    const {reference: linkReference} = await this.getCandidateForDescriptor(descriptor, opts);

    return references
      .filter(reference => reference === linkReference)
      .map(reference => structUtils.makeLocator(descriptor, reference));
  }

  async resolve(locator: Locator, opts: ResolveOptions): Promise<Package> {
    if (!opts.fetchOptions)
      throw new Error(`Assertion failed: This resolver cannot be used unless a fetcher is configured`);

    const packageFetch = await opts.fetchOptions.fetcher.fetch(locator, opts.fetchOptions);

    const manifest = await miscUtils.releaseAfterUseAsync(async () => {
      return await Manifest.find(packageFetch.prefixPath, {baseFs: packageFetch.packageFs});
    }, packageFetch.releaseFs);

    return {
      ...locator,

      version: manifest.version || `0.0.0`,

      languageName: opts.project.configuration.get(`defaultLanguageName`),
      linkType: LinkType.SOFT,

      dependencies: new Map([...manifest.dependencies, ...manifest.devDependencies]),
      peerDependencies: manifest.peerDependencies,

      dependenciesMeta: manifest.dependenciesMeta,
      peerDependenciesMeta: manifest.peerDependenciesMeta,

      bin: manifest.bin,
    };
  }

  private async getCandidateForDescriptor(descriptor: Descriptor, opts: ResolveOptions) {
    const path = descriptor.range.slice(LINK_PROTOCOL.length);

    return structUtils.makeLocator(descriptor, `${LINK_PROTOCOL}${npath.toPortablePath(path)}`);
  }
}
