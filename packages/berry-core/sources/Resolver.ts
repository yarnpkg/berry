import {Descriptor, Locator, Package} from './types';

export interface Resolver {
  supports(descriptor: Descriptor): boolean;

  getCandidates(descriptor: Descriptor): Promise<Array<string>>;

  resolve(locator: Locator): Promise<Package>;
}
