import {ReportError, MessageName, Resolver, ResolveOptions, MinimalResolveOptions} from '@yarnpkg/core';
import {structUtils}                                                               from '@yarnpkg/core';
import {Descriptor, Locator, Package}                                              from '@yarnpkg/core';

import {NpmSemverFetcher}                                                          from './NpmSemverFetcher';
import {PROTOCOL}                                                                  from './constants';
import * as npmHttpUtils                                                           from './npmHttpUtils';

export const TAG_REGEXP = /^[a-z]+$/;

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

  async getCandidates(descriptor: Descriptor, opts: ResolveOptions) {
    const tag = descriptor.range.slice(PROTOCOL.length);

    const registryData = await npmHttpUtils.get(npmHttpUtils.getIdentUrl(descriptor), {
      configuration: opts.project.configuration,
      ident: descriptor,
      json: true,
    });

    if (!Object.prototype.hasOwnProperty.call(registryData, `dist-tags`))
      throw new ReportError(MessageName.REMOTE_INVALID, `Registry returned invalid data - missing "dist-tags" field`);

    const distTags = registryData[`dist-tags`];

    if (!Object.prototype.hasOwnProperty.call(distTags, tag))
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

  async resolve(locator: Locator, opts: ResolveOptions): Promise<Package> {
    // Once transformed into locators (through getCandidates), the tags are resolved by the NpmSemverResolver
    throw new Error(`Unreachable`);
  }
}
