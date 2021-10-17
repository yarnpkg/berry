import {Resolver, ResolveOptions, MinimalResolveOptions} from '@yarnpkg/core';
import {Descriptor, Locator}                             from '@yarnpkg/core';
import {LinkType}                                        from '@yarnpkg/core';
import {structUtils}                                     from '@yarnpkg/core';
import {npath}                                           from '@yarnpkg/fslib';

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

  bindDescriptor(descriptor: Descriptor, fromLocator: Locator, opts: MinimalResolveOptions) {
    return structUtils.bindDescriptor(descriptor, {
      locator: structUtils.stringifyLocator(fromLocator),
    });
  }

  getResolutionDependencies(descriptor: Descriptor, opts: MinimalResolveOptions) {
    return [];
  }

  async getCandidates(descriptor: Descriptor, dependencies: unknown, opts: ResolveOptions) {
    const path = descriptor.range.slice(RAW_LINK_PROTOCOL.length);

    return [structUtils.makeLocator(descriptor, `${RAW_LINK_PROTOCOL}${npath.toPortablePath(path)}`)];
  }

  async getSatisfying(descriptor: Descriptor, references: Array<string>, opts: ResolveOptions) {
    return null;
  }

  async resolve(locator: Locator, opts: ResolveOptions) {
    return {
      ...locator,

      version: `0.0.0`,

      languageName: opts.project.configuration.get(`defaultLanguageName`),
      linkType: LinkType.SOFT,

      conditions: null,

      dependencies: new Map(),
      peerDependencies: new Map(),

      dependenciesMeta: new Map(),
      peerDependenciesMeta: new Map(),

      bin: new Map(),
    };
  }
}
