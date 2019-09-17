import {PortablePath, xfs}                      from '@yarnpkg/fslib';

import {Fetcher, FetchOptions}                  from './Fetcher';
import {MessageName}                            from './Report';
import {Resolver}                               from './Resolver';
import * as structUtils                         from './structUtils';
import * as tgzUtils                            from './tgzUtils';
import {Descriptor, LinkType, Locator, Package} from './types';

export function makeBridgeFor(hostLanguageName: string, guestPkg: Package) {
  if (hostLanguageName === guestPkg.languageName)
    throw new Error(`Bridges can only be generated for mismatching language names (${hostLanguageName} -> ${guestPkg.languageName} doesn't mismatch)`);

  if (hostLanguageName === `unknown`)
    throw new Error(`Bridges shouldn't be generated for the "unknown" language name`);

  return `bridge:${hostLanguageName}/${guestPkg.languageName}:${structUtils.stringifyLocator(guestPkg)}`;
}

export function tryParseBridge(string: string) {
  const match = string.match(/^bridge:([^\/]+)\/([^:]+):(.*)$/);
  if (!match)
    return null;

  const [, hostLanguageName, guestLanguageName, locator] = match;
  return {hostLanguageName, guestLanguageName, bridgedLocator: structUtils.parseLocator(locator)};
}

export function parseBridge(string: string) {
  const bridge = tryParseBridge(string);
  if (bridge === null)
    throw new Error(`Invalid bridge (${string})`);

  return bridge;
}

export type IsBridgeLocatorOpts = {
  hostLanguageName: string,
  guestLanguageName: string,
};

export function isBridgeLocator(locator: Locator, opts: IsBridgeLocatorOpts) {
  const match = tryParseBridge(locator.reference);
  if (match === null)
    return false;

  const {hostLanguageName, guestLanguageName} = match;
  if (hostLanguageName !== opts.hostLanguageName || guestLanguageName !== opts.guestLanguageName)
    return false;

  return true;
}

export type IsBridgeDescriptorOpts = {
  hostLanguageName: string,
  guestLanguageName: string,
};

export function isBridgeDescriptor(descriptor: Descriptor, opts: IsBridgeDescriptorOpts) {
  const match = tryParseBridge(descriptor.range);
  if (match === null)
    return false;

  const {hostLanguageName, guestLanguageName} = match;
  if (hostLanguageName !== opts.hostLanguageName || guestLanguageName !== opts.guestLanguageName)
    return false;

  return true;
}

export type MakeBridgeResolverOpts = {
  hostLanguageName: string,
  guestLanguageName: string,
};

export function makeBridgeResolver(opts: MakeBridgeResolverOpts) {
  return class BridgeResolver implements Resolver {
    supportsDescriptor(descriptor: Descriptor) {
      return isBridgeDescriptor(descriptor, opts);
    }

    supportsLocator(locator: Locator) {
      return isBridgeLocator(locator, opts);
    }

    shouldPersistResolution() {
      return true;
    }

    bindDescriptor(descriptor: Descriptor) {
      return descriptor;
    }

    async getCandidates(descriptor: Descriptor) {
      return [structUtils.convertDescriptorToLocator(descriptor)];
    }

    async resolve(locator: Locator) {
      const {bridgedLocator} = parseBridge(locator.reference);

      return {
        ...locator,

        version: `0.0.0`,

        languageName: opts.hostLanguageName,
        linkType: LinkType.HARD,

        dependencies: new Map([[bridgedLocator.identHash, structUtils.convertLocatorToDescriptor(bridgedLocator)]]),
        peerDependencies: new Map(),

        dependenciesMeta: new Map(),
        peerDependenciesMeta: new Map(),

        bin: new Map(),
      };
    }
  };
}

export type MakeBridgeFetcherOpts = {
  hostLanguageName: string,
  guestLanguageName: string,
  generateBridge: (location: PortablePath) => Promise<void>,
};

export function makeBridgeFetcher(opts: MakeBridgeFetcherOpts) {
  const generateBridge = async (locator: Locator) => {
    const directory = await xfs.mktempPromise();
    await opts.generateBridge(directory);

    return await tgzUtils.makeArchiveFromDirectory(directory, {
      prefixPath: `/sources` as PortablePath,
    });
  };

  return class BridgeFetcher implements Fetcher {
    supports(locator: Locator) {
      return isBridgeLocator(locator, opts);
    }

    getLocalPath(locator: Locator, opts: FetchOptions) {
      return null;
    }

    async fetch(locator: Locator, opts: FetchOptions) {
      const expectedChecksum = opts.checksums.get(locator.locatorHash) || null;

      const [packageFs, releaseFs, checksum] = await opts.cache.fetchPackageFromCache(
        locator,
        expectedChecksum,
        async () => {
          opts.report.reportInfoOnce(MessageName.FETCH_NOT_CACHED, `${structUtils.prettyLocator(opts.project.configuration, locator)} can't be found in the cache and will be fetched from the disk`);
          return await generateBridge(locator);
        },
      );

      return {
        packageFs,
        releaseFs,
        prefixPath: `/sources` as PortablePath,
        localPath: this.getLocalPath(locator, opts),
        checksum,
      };
    }
  };
}
