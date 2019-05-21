import {ReportError, MessageName, Resolver, ResolveOptions, MinimalResolveOptions} from '@berry/core';
import {structUtils}                                                               from '@berry/core';
import {Descriptor, Locator, Package}                                              from '@berry/core';

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

    return [structUtils.makeLocator(descriptor, `${PROTOCOL}${distTags[tag]}`)];
  }

  async resolve(locator: Locator, opts: ResolveOptions): Promise<Package> {
    // Once transformed into locators, the tags are resolved by the NpmSemverResolver
    throw new Error(`Unreachable`);
  }
}
