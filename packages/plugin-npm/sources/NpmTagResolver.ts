import {ReportError, MessageName, Resolver, ResolveOptions, MinimalResolveOptions} from '@berry/core';
import {httpUtils, structUtils}                                                    from '@berry/core';
import {Ident, Descriptor, Locator, Package}                                       from '@berry/core';

import {DEFAULT_REGISTRY, PROTOCOL}                                                from './constants';

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

    const httpResponse = await httpUtils.get(this.getIdentUrl(descriptor, opts), opts.project.configuration);
    const registryData = JSON.parse(httpResponse.toString());

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

  private getIdentUrl(ident: Ident, opts: MinimalResolveOptions) {
    const registry = opts.project.configuration.registryServer || DEFAULT_REGISTRY;

    if (ident.scope) {
      return `${registry}/@${ident.scope}%2f${ident.name}`;
    } else {
      return `${registry}/${ident.name}`;
    }
  }
}
