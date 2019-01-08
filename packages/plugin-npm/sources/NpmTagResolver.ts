import {Resolver, ResolveOptions, MinimalResolveOptions} from '@berry/core';
import {httpUtils, structUtils}                          from '@berry/core';
import {Ident, Descriptor, Locator, Package}             from '@berry/core';

import {DEFAULT_REGISTRY, TAG_REGEXP}                    from './constants';

export class NpmTagResolver implements Resolver {
  supportsDescriptor(descriptor: Descriptor, opts: MinimalResolveOptions) {
    if (!TAG_REGEXP.test(descriptor.range))
      return false;

    return true;
  }

  supportsLocator(locator: Locator, opts: MinimalResolveOptions) {
    // Once transformed into locators, the tags are resolved by the NpmSemverResolver
    return false;
  }

  shouldPersistResolution(locator: Locator, opts: MinimalResolveOptions): boolean {
    // Once transformed into locators, the tags are resolved by the NpmSemverResolver
    throw new Error(`Unreachable`);
  }

  bindDescriptor(descriptor: Descriptor, fromLocator: Locator, opts: MinimalResolveOptions) {
    return descriptor;
  }

  async getCandidates(descriptor: Descriptor, opts: ResolveOptions) {
    const httpResponse = await httpUtils.get(this.getIdentUrl(descriptor, opts), opts.project.configuration);
    const registryData = JSON.parse(httpResponse.toString());

    if (!Object.prototype.hasOwnProperty.call(registryData, `dist-tags`))
      throw new Error(`Registry returned invalid data for "${structUtils.prettyDescriptor(opts.project.configuration, descriptor)}"`);

    const distTags = registryData[`dist-tags`];
      
    if (!Object.prototype.hasOwnProperty.call(distTags, descriptor.range))
      throw new Error(`Registry failed to return tag "${descriptor.range}"`);

    const resolution = Object.prototype.hasOwnProperty.call(distTags, descriptor.range)
      ? distTags[descriptor.range]
      : null;

    return resolution ? [resolution] : [];
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
