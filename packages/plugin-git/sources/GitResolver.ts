import {Resolver, ResolveOptions, MinimalResolveOptions, Package} from '@yarnpkg/core';
import {miscUtils, structUtils}                                   from '@yarnpkg/core';
import {LinkType}                                                 from '@yarnpkg/core';
import {Descriptor, Locator, Manifest}                            from '@yarnpkg/core';

import * as gitUtils                                              from './gitUtils';

export class GitResolver implements Resolver {
  supportsDescriptor(descriptor: Descriptor, opts: MinimalResolveOptions) {
    return gitUtils.isGitUrl(descriptor.range);
  }

  supportsLocator(locator: Locator, opts: MinimalResolveOptions) {
    return gitUtils.isGitUrl(locator.reference);
  }

  shouldPersistResolution(locator: Locator, opts: MinimalResolveOptions) {
    return true;
  }

  bindDescriptor(descriptor: Descriptor, fromLocator: Locator, opts: MinimalResolveOptions) {
    return descriptor;
  }

  getResolutionDependencies(descriptor: Descriptor, opts: MinimalResolveOptions) {
    return {};
  }

  async getCandidates(descriptor: Descriptor, dependencies: unknown, opts: ResolveOptions) {
    const reference = await gitUtils.resolveUrl(descriptor.range, opts.project.configuration);
    const locator = structUtils.makeLocator(descriptor, reference);

    return [locator];
  }

  async getSatisfying(descriptor: Descriptor, dependencies: Record<string, Package>, locators: Array<Locator>, opts: ResolveOptions) {
    const splitRange = gitUtils.splitRepoUrl(descriptor.range);

    const filtered = locators.filter(locator => {
      if (locator.identHash !== descriptor.identHash)
        return false;

      const splitReference = gitUtils.splitRepoUrl(locator.reference);
      if (splitRange.repo !== splitReference.repo)
        return false;

      // We can only guarantee the coherence of commit selectors, since we have
      // no way to know whether HEAD used to be at the specified commits at
      // some point in time. Similarly, tags can be modified, so we can't rely
      // on them either.
      if (splitRange.treeish.protocol === gitUtils.TreeishProtocols.Commit && splitRange.treeish.request !== splitReference.treeish.request)
        return false;

      return true;
    });

    return {
      locators: filtered,
      sorted: false,
    };
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

      dependencies: opts.project.configuration.normalizeDependencyMap(manifest.dependencies),
      peerDependencies: manifest.peerDependencies,

      dependenciesMeta: manifest.dependenciesMeta,
      peerDependenciesMeta: manifest.peerDependenciesMeta,

      bin: manifest.bin,
    };
  }
}
