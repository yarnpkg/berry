import {Resolver}                      from './Resolver';
import * as structUtils                from './structUtils';
import {Descriptor, LinkType, Locator} from './types';

export type IsBridgeLocatorOpts = {
  hostLanguageName: string,
  guestLanguageName: string,
};

export function isBridgeLocator(locator: Locator, opts: IsBridgeLocatorOpts) {
  return false;
}

export type IsBridgeDescriptorOpts = {
  hostLanguageName: string,
  guestLanguageName: string,
};

export function isBridgeDescriptor(descriptor: Descriptor, opts: IsBridgeDescriptorOpts) {
  return false;
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
      return {
        ...locator,

        version: `0.0.0`,

        languageName: opts.hostLanguageName,
        linkType: LinkType.HARD,

        dependencies: new Map(),
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
};

export function makeBridgeFetcher(opts: MakeBridgeFetcherOpts) {

}
