import {FetchOptions}                 from './Fetcher';
import {Project}                      from './Project';
import {Descriptor, Locator, Package} from './types';

export type MinimalResolveOptions = {
  project: Project,
  resolver: Resolver,
};

export type ResolveOptions =
  MinimalResolveOptions &
  FetchOptions;

export interface Resolver {
  supportsDescriptor(descriptor: Descriptor, opts: MinimalResolveOptions): boolean;

  supportsLocator(locator: Locator, opts: MinimalResolveOptions): boolean;

  shouldPersistResolution(locator: Locator, opts: MinimalResolveOptions): boolean;

  normalizeDescriptor(descriptor: Descriptor, fromLocator: Locator, opts: MinimalResolveOptions): Promise<Descriptor>;

  getCandidates(descriptor: Descriptor, opts: ResolveOptions): Promise<Array<string>>;

  resolve(locator: Locator, opts: ResolveOptions): Promise<Package>;
}
