import {ReportError, MessageName, Resolver, ResolveOptions, MinimalResolveOptions, Manifest, Package, miscUtils} from '@yarnpkg/core';
import {Descriptor, Locator, semverUtils}                                                                        from '@yarnpkg/core';
import {LinkType}                                                                                                from '@yarnpkg/core';
import {structUtils}                                                                                             from '@yarnpkg/core';
import semver                                                                                                    from 'semver';

import {NpmSemverFetcher}                                                                                        from './NpmSemverFetcher';
import {PROTOCOL}                                                                                                from './constants';
import * as npmHttpUtils                                                                                         from './npmHttpUtils';

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
    return {};
  }

  async getCandidates(descriptor: Descriptor, dependencies: Record<string, Package>, opts: ResolveOptions) {
    const range = semverUtils.validRange(descriptor.range.slice(PROTOCOL.length));
    if (range === null)
      throw new Error(`Expected a valid range, got ${descriptor.range.slice(PROTOCOL.length)}`);

    const registryData = await npmHttpUtils.getPackageMetadata(descriptor, {
      cache: opts.fetchOptions?.cache,
      project: opts.project,
      version: semver.valid(range.raw) ? range.raw : undefined,
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

  async getSatisfying(descriptor: Descriptor, dependencies: Record<string, Package>, locators: Array<Locator>, opts: ResolveOptions) {
    const range = semverUtils.validRange(descriptor.range.slice(PROTOCOL.length));
    if (range === null)
      throw new Error(`Expected a valid range, got ${descriptor.range.slice(PROTOCOL.length)}`);

    const results = miscUtils.mapAndFilter(locators, locator => {
      if (locator.identHash !== descriptor.identHash)
        return miscUtils.mapAndFilter.skip;

      const parsedRange = structUtils.tryParseRange(locator.reference, {requireProtocol: PROTOCOL});
      if (!parsedRange)
        return miscUtils.mapAndFilter.skip;

      const version = new semverUtils.SemVer(parsedRange.selector);
      if (!range.test(version))
        return miscUtils.mapAndFilter.skip;

      return {locator, version};
    });

    const sortedResults = results
      .sort((a, b) => -a.version.compare(b.version))
      .map(({locator}) => locator);

    return {
      locators: sortedResults,
      sorted: true,
    };
  }

  async resolve(locator: Locator, opts: ResolveOptions) {
    const {selector} = structUtils.parseRange(locator.reference);

    const version = semverUtils.clean(selector);
    if (version === null)
      throw new ReportError(MessageName.RESOLVER_NOT_FOUND, `The npm semver resolver got selected, but the version isn't semver`);

    const registryData = await npmHttpUtils.getPackageMetadata(locator, {
      cache: opts.fetchOptions?.cache,
      project: opts.project,
      version,
    });

    if (!Object.hasOwn(registryData, `versions`))
      throw new ReportError(MessageName.REMOTE_INVALID, `Registry returned invalid data for - missing "versions" field`);

    if (!Object.hasOwn(registryData.versions, version))
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
          break;
        }
      }
    }

    return {
      ...locator,

      version,

      languageName: `node`,
      linkType: LinkType.HARD,

      conditions: manifest.getConditions(),

      dependencies: opts.project.configuration.normalizeDependencyMap(manifest.dependencies),
      peerDependencies: manifest.peerDependencies,

      dependenciesMeta: manifest.dependenciesMeta,
      peerDependenciesMeta: manifest.peerDependenciesMeta,

      bin: manifest.bin,
    };
  }
}
