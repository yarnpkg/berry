import {ReportError, MessageName, Resolver, ResolveOptions, MinimalResolveOptions, Manifest} from '@berry/core';
import {Ident, Descriptor, Locator}                                                          from '@berry/core';
import {LinkType}                                                                            from '@berry/core';
import {httpUtils, structUtils}                                                              from '@berry/core';
import semver                                                                                from 'semver';

import {PROTOCOL}                                                                            from './constants';

export class NpmSemverResolver implements Resolver {
  supportsDescriptor(descriptor: Descriptor, opts: MinimalResolveOptions) {
    if (!descriptor.range.startsWith(PROTOCOL))
      return false;

    if (!semver.validRange(descriptor.range.slice(PROTOCOL.length)))
      return false;

    return true;
  }

  supportsLocator(locator: Locator, opts: MinimalResolveOptions) {
    if (!locator.reference.startsWith(PROTOCOL))
      return false;

    if (!semver.valid(locator.reference.slice(PROTOCOL.length)))
      return false;

    return true;
  }

  shouldPersistResolution(locator: Locator, opts: MinimalResolveOptions) {
    return true;
  }

  bindDescriptor(descriptor: Descriptor, fromLocator: Locator, opts: MinimalResolveOptions) {
    return descriptor;
  }

  async getCandidates(descriptor: Descriptor, opts: ResolveOptions) {
    const range = descriptor.range.slice(PROTOCOL.length);

    if (semver.valid(range))
      return [structUtils.convertDescriptorToLocator(descriptor)];

    const httpResponse = await httpUtils.get(this.getIdentUrl(descriptor, opts), opts.project.configuration);

    const versions = Object.keys(JSON.parse(httpResponse.toString()).versions);
    const candidates = versions.filter(version => semver.satisfies(version, range));

    candidates.sort((a, b) => {
      return -semver.compare(a, b);
    });

    return candidates.map(version => {
      return structUtils.makeLocator(descriptor, `${PROTOCOL}${version}`);
    });
  }

  async resolve(locator: Locator, opts: ResolveOptions) {
    const version = locator.reference.slice(PROTOCOL.length);

    const httpResponse = await httpUtils.get(this.getIdentUrl(locator, opts), opts.project.configuration);
    const registryData = JSON.parse(httpResponse.toString());

    if (!Object.prototype.hasOwnProperty.call(registryData, `versions`))
      throw new ReportError(MessageName.REMOTE_INVALID, `Registry returned invalid data for - missing "versions" field`);

    if (!Object.prototype.hasOwnProperty.call(registryData.versions, version))
      throw new ReportError(MessageName.REMOTE_NOT_FOUND, `Registry failed to return reference "${version}"`);

    const manifest = new Manifest();
    manifest.load(registryData.versions[version]);

    return {
      ... locator,

      version,

      languageName: `node`,
      linkType: LinkType.HARD,

      dependencies: manifest.dependencies,
      peerDependencies: manifest.peerDependencies,

      dependenciesMeta: manifest.dependenciesMeta,
      peerDependenciesMeta: manifest.peerDependenciesMeta,
    };
  }

  private getIdentUrl(ident: Ident, opts: MinimalResolveOptions) {
    const registry = opts.project.configuration.get(`npmRegistryServer`);

    if (ident.scope) {
      return `${registry}/@${ident.scope}%2f${ident.name}`;
    } else {
      return `${registry}/${ident.name}`;
    }
  }
}
