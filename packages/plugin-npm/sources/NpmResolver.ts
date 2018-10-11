import semver = require('semver');

import {Resolver, ResolveOptions, Manifest}            from '@berry/core';
import {httpUtils, structUtils}              from '@berry/core';
import {Ident, Descriptor, Locator, Package} from '@berry/core';

export class NpmResolver implements Resolver {
  supportsDescriptor(descriptor: Descriptor, opts: ResolveOptions) {
    if (!semver.validRange(descriptor.range))
      return false;

    return true;
  }

  supportsLocator(locator: Locator, opts: ResolveOptions) {
    if (!semver.valid(locator.reference))
      return false;

    return true;
  }

  async getCandidates(descriptor: Descriptor, opts: ResolveOptions) {
    if (semver.valid(descriptor.range))
      return [descriptor.range];

    const httpResponse = await httpUtils.get(this.getIdentUrl(descriptor));

    const versions = Object.keys(JSON.parse(httpResponse.toString()).versions);
    const candidates = versions.filter(version => semver.satisfies(version, descriptor.range));

    return candidates;
  }

  async resolve(locator: Locator, opts: ResolveOptions) {
    if (!semver.valid(locator.reference))
      throw new Error(`Invalid reference`);

    const httpResponse = await httpUtils.get(this.getIdentUrl(locator));
    const registryData = JSON.parse(httpResponse.toString());

    if (!Object.prototype.hasOwnProperty.call(registryData, `versions`))
      throw new Error(`Registry returned invalid data for "${structUtils.prettyLocator(locator)}"`);

    if (!Object.prototype.hasOwnProperty.call(registryData.versions, locator.reference))
      throw new Error(`Registry failed to return reference "${locator.reference}"`);

    const manifest = new Manifest();
    manifest.load(registryData.versions[locator.reference]);

    const dependencies = manifest.dependencies;
    const peerDependencies = manifest.peerDependencies;

    return {... locator, dependencies, peerDependencies};
  }

  private getIdentUrl(ident: Ident) {
    if (ident.scope) {
      return `https://registry.npmjs.org/@${ident.scope}%2f${ident.name}`;
    } else {
      return `https://registry.npmjs.org/${ident.name}`;
    }
  }
}
