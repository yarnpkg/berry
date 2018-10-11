import {Project}                      from './Project';
import {Descriptor, Locator, Package} from './types';

export type ResolveOptions = {
  project: Project,
};

export interface Resolver {
  supportsDescriptor(descriptor: Descriptor, opts: ResolveOptions): boolean;

  supportsLocator(locator: Locator, opts: ResolveOptions): boolean;

  getCandidates(descriptor: Descriptor, opts: ResolveOptions): Promise<Array<string>>;

  resolve(locator: Locator, opts: ResolveOptions): Promise<Package>;
}
