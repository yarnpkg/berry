import semver = require('semver');

import {Resolver, ResolveOptions, MinimalResolveOptions, Manifest} from '@berry/core';
import {httpUtils, structUtils}                                    from '@berry/core';
import {Ident, Descriptor, Locator}                                from '@berry/core';

import {DEFAULT_REGISTRY}                                          from './constants';

export class NpmSemverResolver implements Resolver {
  supportsDescriptor(descriptor: Descriptor, opts: MinimalResolveOptions) {
    if (!semver.validRange(descriptor.range))
      return false;

    return true;
  }

  supportsLocator(locator: Locator, opts: MinimalResolveOptions) {
    if (!semver.valid(locator.reference))
      return false;

    return true;
  }

  shouldPersistResolution(locator: Locator, opts: MinimalResolveOptions) {
    return true;
  }

  async normalizeDescriptor(descriptor: Descriptor, fromLocator: Locator, opts: MinimalResolveOptions) {
    return descriptor;
  }

  async getCandidates(descriptor: Descriptor, opts: ResolveOptions) {
    if (semver.valid(descriptor.range))
      return [descriptor.range];

    const httpResponse = await httpUtils.get(this.getIdentUrl(descriptor, opts), opts.project.configuration);

    const versions = Object.keys(JSON.parse(httpResponse.toString()).versions);
    const candidates = versions.filter(version => semver.satisfies(version, descriptor.range));

    return candidates;
  }

  async resolve(locator: Locator, opts: ResolveOptions) {
    if (!semver.valid(locator.reference))
      throw new Error(`Invalid reference`);

    const httpResponse = await httpUtils.get(this.getIdentUrl(locator, opts), opts.project.configuration);
    const registryData = JSON.parse(httpResponse.toString());

    if (!Object.prototype.hasOwnProperty.call(registryData, `versions`))
      throw new Error(`Registry returned invalid data for "${structUtils.prettyLocator(opts.project.configuration, locator)}"`);

    if (!Object.prototype.hasOwnProperty.call(registryData.versions, locator.reference))
      throw new Error(`Registry failed to return reference "${locator.reference}"`);

    const manifest = new Manifest();
    manifest.load(registryData.versions[locator.reference]);

    const binaries = manifest.bin;
    const dependencies = manifest.dependencies;
    const peerDependencies = manifest.peerDependencies;

    return {... locator, binaries, dependencies, peerDependencies};
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
