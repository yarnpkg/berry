import {ReportError, MessageName, Resolver, ResolveOptions, MinimalResolveOptions, Manifest, DescriptorHash, Package, miscUtils} from '@yarnpkg/core';
import {Descriptor, Locator, semverUtils}                                                                                        from '@yarnpkg/core';
import {LinkType}                                                                                                                from '@yarnpkg/core';
import {structUtils}                                                                                                             from '@yarnpkg/core';
import semver                                                                                                                    from 'semver';

import {NpmSemverFetcher}                                                                                                        from './NpmSemverFetcher';
import {PROTOCOL}                                                                                                                from './constants';
import * as npmHttpUtils                                                                                                         from './npmHttpUtils';

const NODE_GYP_IDENT = structUtils.makeIdent(null, `node-gyp`);
const NODE_GYP_MATCH = /\b(node-gyp|prebuild-install)\b/;

export class NpmSemverResolver implements Resolver {
  supportsDescriptor(descriptor: Descriptor, opts: MinimalResolveOptions) {
    if (!descriptor.range.startsWith(PROTOCOL))
      return false;

    return !!semverUtils.validRange(descriptor.range.slice(PROTOCOL.length));
  }

  supportsLocator(locator: Locator, opts: MinimalResolveOptions) {
    if (!locator.reference.startsWith(PROTOCOL))
      return false;

    const {selector} = structUtils.parseRange(locator.reference);
    if (!semver.valid(selector))
      return false;

    return true;
  }

  shouldPersistResolution(locator: Locator, opts: MinimalResolveOptions) {
    return true;
  }

  bindDescriptor(descriptor: Descriptor, fromLocator: Locator, opts: MinimalResolveOptions) {
    return descriptor;
  }

  getResolutionDependencies(descriptor: Descriptor, opts: MinimalResolveOptions) {
    return [];
  }

  async getCandidates(descriptor: Descriptor, dependencies: Map<DescriptorHash, Package>, opts: ResolveOptions) {
    const range = semverUtils.validRange(descriptor.range.slice(PROTOCOL.length));
    if (range === null)
      throw new Error(`Expected a valid range, got ${descriptor.range.slice(PROTOCOL.length)}`);

    const registryData = await npmHttpUtils.get(npmHttpUtils.getIdentUrl(descriptor), {
      configuration: opts.project.configuration,
      ident: descriptor,
      jsonResponse: true,
    });

    const candidates = miscUtils.mapAndFilter(Object.keys(registryData.versions), version => {
      try {
        const candidate = new semverUtils.SemVer(version);
        if (range.test(candidate)) {
          return candidate;
        }
      } catch { }

      return miscUtils.mapAndFilter.skip;
    });

    const noDeprecatedCandidates = candidates.filter(version => {
      return !registryData.versions[version.raw].deprecated;
    });

    // If there are versions that aren't deprecated, use them
    const finalCandidates = noDeprecatedCandidates.length > 0
      ? noDeprecatedCandidates
      : candidates;

    finalCandidates.sort((a, b) => {
      return -a.compare(b);
    });

    return finalCandidates.map(version => {
      const versionLocator = structUtils.makeLocator(descriptor, `${PROTOCOL}${version.raw}`);
      const archiveUrl = registryData.versions[version.raw].dist.tarball;

      if (NpmSemverFetcher.isConventionalTarballUrl(versionLocator, archiveUrl, {configuration: opts.project.configuration})) {
        return versionLocator;
      } else {
        return structUtils.bindLocator(versionLocator, {__archiveUrl: archiveUrl});
      }
    });
  }

  async getSatisfying(descriptor: Descriptor, references: Array<string>, opts: ResolveOptions) {
    const range = semverUtils.validRange(descriptor.range.slice(PROTOCOL.length));
    if (range === null)
      throw new Error(`Expected a valid range, got ${descriptor.range.slice(PROTOCOL.length)}`);

    return miscUtils.mapAndFilter(references, reference => {
      try {
        const {selector} = structUtils.parseRange(reference, {requireProtocol: PROTOCOL});
        const version = new semverUtils.SemVer(selector);

        if (range.test(version)) {
          return {reference, version};
        }
      } catch { }

      return miscUtils.mapAndFilter.skip;
    })
      .sort((a, b) => -a.version.compare(b.version))
      .map(({reference}) => structUtils.makeLocator(descriptor, reference));
  }

  async resolve(locator: Locator, opts: ResolveOptions) {
    const {selector} = structUtils.parseRange(locator.reference);

    const version = semverUtils.clean(selector);
    if (version === null)
      throw new ReportError(MessageName.RESOLVER_NOT_FOUND, `The npm semver resolver got selected, but the version isn't semver`);

    const registryData = await npmHttpUtils.get(npmHttpUtils.getIdentUrl(locator), {
      configuration: opts.project.configuration,
      ident: locator,
      jsonResponse: true,
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
          manifest.dependencies.set(NODE_GYP_IDENT.identHash, structUtils.makeDescriptor(NODE_GYP_IDENT, `latest`));
          opts.report.reportWarningOnce(MessageName.NODE_GYP_INJECTED, `${structUtils.prettyLocator(opts.project.configuration, locator)}: Implicit dependencies on node-gyp are discouraged`);
          break;
        }
      }
    }

    // Apparently some packages have a `deprecated` field set to an empty string
    // (even though that shouldn't be possible since `npm deprecate ... ""` undeprecates
    // the package, completely removing the `deprecated` field). Both the npm website
    // and all other package managers skip showing deprecation warnings in this case.
    if (typeof manifest.raw.deprecated === `string` && manifest.raw.deprecated !== ``) {
      const prefix = structUtils.prettyLocator(opts.project.configuration, locator);

      // If the `deprecated` field contains anything, even only whitespace, the package
      // is considered deprecated by both the npm website and CLI.
      const deprecationMessage = manifest.raw.deprecated.match(/\S/)
        ? `${prefix} is deprecated: ${manifest.raw.deprecated}`
        : `${prefix} is deprecated`;

      opts.report.reportWarningOnce(MessageName.DEPRECATED_PACKAGE, deprecationMessage);
    }

    return {
      ...locator,

      version,

      languageName: `node`,
      linkType: LinkType.HARD,

      conditions: manifest.getConditions(),

      dependencies: manifest.dependencies,
      peerDependencies: manifest.peerDependencies,

      dependenciesMeta: manifest.dependenciesMeta,
      peerDependenciesMeta: manifest.peerDependenciesMeta,

      bin: manifest.bin,
    };
  }
}
