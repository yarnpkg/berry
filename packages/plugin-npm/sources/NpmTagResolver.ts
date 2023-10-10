import {ReportError, MessageName, Resolver, ResolveOptions, MinimalResolveOptions, TAG_REGEXP} from '@yarnpkg/core';
import {structUtils}                                                                           from '@yarnpkg/core';
import {Descriptor, Locator, Package}                                                          from '@yarnpkg/core';
import semver                                                                                  from 'semver';

import {NpmSemverFetcher}                                                                      from './NpmSemverFetcher';
import {PROTOCOL}                                                                              from './constants';
import * as npmHttpUtils                                                                       from './npmHttpUtils';

export class NpmTagResolver implements Resolver {
  supportsDescriptor(descriptor: Descriptor, opts: MinimalResolveOptions) {
    if (!descriptor.range.startsWith(PROTOCOL))
      return false;

    if (!TAG_REGEXP.test(descriptor.range.slice(PROTOCOL.length)))
      return false;

    return true;
  }

  supportsLocator(locator: Locator, opts: MinimalResolveOptions) {
    // Once transformed into locators, the tags are resolved by the NpmSemverResolver
    return false;
  }

  shouldPersistResolution(locator: Locator, opts: MinimalResolveOptions): never {
    // Once transformed into locators, the tags are resolved by the NpmSemverResolver
    throw new Error(`Unreachable`);
  }

  bindDescriptor(descriptor: Descriptor, fromLocator: Locator, opts: MinimalResolveOptions) {
    return descriptor;
  }

  getResolutionDependencies(descriptor: Descriptor, opts: MinimalResolveOptions) {
    return {};
  }

  async getCandidates(descriptor: Descriptor, dependencies: unknown, opts: ResolveOptions) {
    const tag = descriptor.range.slice(PROTOCOL.length);

    const registryData = await npmHttpUtils.getPackageMetadata(descriptor, {
      cache: opts.fetchOptions?.cache,
      project: opts.project,
    });

    if (!Object.hasOwn(registryData, `dist-tags`))
      throw new ReportError(MessageName.REMOTE_INVALID, `Registry returned invalid data - missing "dist-tags" field`);

    const distTags = registryData[`dist-tags`];

    if (!Object.hasOwn(distTags, tag))
      throw new ReportError(MessageName.REMOTE_NOT_FOUND, `Registry failed to return tag "${tag}"`);

    const version = distTags[tag];
    const versionLocator = structUtils.makeLocator(descriptor, `${PROTOCOL}${version}`);

    const archiveUrl = registryData.versions[version].dist.tarball;

    if (NpmSemverFetcher.isConventionalTarballUrl(versionLocator, archiveUrl, {configuration: opts.project.configuration})) {
      return [versionLocator];
    } else {
      return [structUtils.bindLocator(versionLocator, {__archiveUrl: archiveUrl})];
    }
  }

  async getSatisfying(descriptor: Descriptor, dependencies: Record<string, Package>, locators: Array<Locator>, opts: ResolveOptions) {
    const filtered: Array<Locator> = [];

    for (const locator of locators) {
      if (locator.identHash !== descriptor.identHash)
        continue;

      const parsedRange = structUtils.tryParseRange(locator.reference, {requireProtocol: PROTOCOL});
      if (!parsedRange || !semver.valid(parsedRange.selector))
        continue;

      if (parsedRange.params?.__archiveUrl) {
        const newRange = structUtils.makeRange({protocol: PROTOCOL, selector: parsedRange.selector, source: null, params: null});
        const [resolvedLocator] = await opts.resolver.getCandidates(structUtils.makeDescriptor(descriptor, newRange), dependencies, opts);
        if (locator.reference !== resolvedLocator.reference) {
          continue;
        }
      }

      filtered.push(locator);
    }

    return {
      locators: filtered,
      sorted: false,
    };
  }

  async resolve(locator: Locator, opts: ResolveOptions): Promise<Package> {
    // Once transformed into locators (through getCandidates), the tags are resolved by the NpmSemverResolver
    throw new Error(`Unreachable`);
  }
}
