import {ReportError, MessageName, Resolver, ResolveOptions, MinimalResolveOptions, Manifest} from '@berry/core';
import {Ident, Descriptor, Locator}                                                          from '@berry/core';
import {LinkType}                                                                            from '@berry/core';
import {structUtils}                                                                         from '@berry/core';
import semver                                                                                from 'semver';

import {PROTOCOL}                                                                            from './constants';
import * as npmHttpUtils                                                                     from './npmHttpUtils';

const NODE_GYP_IDENT = structUtils.makeIdent(null, `node-gyp`);
const NODE_GYP_MATCH = /\b(node-gyp|prebuild-install)\b/;

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

    const registryData = await npmHttpUtils.get(this.getIdentUrl(descriptor, opts), {
      configuration: opts.project.configuration,
      ident: descriptor,
      json: true,
    });

    const versions = Object.keys(registryData.versions);
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

    const registryData = await npmHttpUtils.get(this.getIdentUrl(locator, opts), {
      configuration: opts.project.configuration,
      ident: locator,
      json: true,
    });

    if (!Object.prototype.hasOwnProperty.call(registryData, `versions`))
      throw new ReportError(MessageName.REMOTE_INVALID, `Registry returned invalid data for - missing "versions" field`);

    if (!Object.prototype.hasOwnProperty.call(registryData.versions, version))
      throw new ReportError(MessageName.REMOTE_NOT_FOUND, `Registry failed to return reference "${version}"`);

    const manifest = new Manifest();
    manifest.load(registryData.versions[version]);

    // Manually add node-gyp dependency if there is a script using it and not already set
    // This is because the npm registry will automatically add a `node-gyp rebuild` install script
    // in the metadata if there is not already an install script and a binding.gyp file exists.
    // Also, node-gyp is not always set as a dependency in packages, so it will also be added if used in scripts.
    if (!manifest.dependencies.has(NODE_GYP_IDENT.identHash) && !manifest.peerDependencies.has(NODE_GYP_IDENT.identHash)) {
      for (const value of manifest.scripts.values()) {
        if (value.match(NODE_GYP_MATCH)) {
          manifest.dependencies.set(NODE_GYP_IDENT.identHash,  structUtils.makeDescriptor(NODE_GYP_IDENT, `*`));
          opts.report.reportWarning(MessageName.NODE_GYP_INJECTED, `${structUtils.prettyLocator(opts.project.configuration, locator)}: Implicit dependencies on node-gyp are discouraged`);
          break;
        }
      }
    }

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
    if (ident.scope) {
      return `/@${ident.scope}%2f${ident.name}`;
    } else {
      return `/${ident.name}`;
    }
  }
}
