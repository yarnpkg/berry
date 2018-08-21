import semver = require('semver');

import {Resolver}                            from '@berry/core';
import {httpUtils, structUtils}              from '@berry/core';
import {Ident, Descriptor, Locator, Package} from '@berry/core';

export class NpmResolver implements Resolver {
  supports(descriptor: Descriptor): boolean {
    if (!semver.validRange(descriptor.range))
      return false;

    return true;
  }

  async getCandidates(descriptor: Descriptor): Promise<Array<string>> {
    if (semver.valid(descriptor.range))
      return [descriptor.range];

    const httpResponse = await httpUtils.get(this.getIdentUrl(descriptor));

    const versions = Object.keys(JSON.parse(httpResponse.toString()).versions);
    const candidates = versions.filter(version => semver.satisfies(version, descriptor.range));

    return candidates;
  }

  async resolve(locator: Locator): Promise<Package> {
    if (!semver.valid(locator.reference))
      throw new Error(`Invalid reference`);

    const httpResponse = await httpUtils.get(this.getIdentUrl(locator));
    const registryData = JSON.parse(httpResponse.toString());

    if (!Object.prototype.hasOwnProperty.call(registryData, `versions`))
      throw new Error(`Registry returned invalid data for "${structUtils.prettyLocator(locator)}"`);

    if (!Object.prototype.hasOwnProperty.call(registryData.versions, locator.reference))
      throw new Error(`Registry failed to return reference "${locator.reference}"`);

    const versionData = registryData.versions[locator.reference];

    const dependencies = new Map();
    const peerDependencies = new Map();

    for (const entry of Object.keys(versionData.dependencies || {})) {
      const descriptor = structUtils.makeDescriptor(structUtils.parseIdent(entry), versionData.dependencies[entry]);
      dependencies.set(descriptor.descriptorHash, descriptor);
    }

    for (const entry of Object.keys(versionData.peerDependencies || {})) {
      const descriptor = structUtils.makeDescriptor(structUtils.parseIdent(entry), versionData.peerDependencies[entry]);
      peerDependencies.set(descriptor.descriptorHash, descriptor);
    }

    return {... locator, dependencies, peerDependencies};
  }

  getIdentUrl(ident: Ident) {
    if (ident.scope) {
      return `https://registry.npmjs.org/@${ident.scope}%2f${ident.name}`;
    } else {
      return `https://registry.npmjs.org/${ident.name}`;
    }
  }
}
