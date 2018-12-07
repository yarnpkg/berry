import {FakeFS}           from '@berry/zipfs';

import {Cache}            from './Cache';
import {Project}          from './Project';
import {Package, Locator} from './types';

export type MinimalLinkOptions = {
  project: Project,
};

export type LinkOptions = MinimalLinkOptions & {
};

export interface DependencyTreeTraversal<State> {
  onRoot(locator: Locator, targetFs: FakeFS | null): Promise<State>;
  onEdge(state: State, locator: Locator): Promise<State>;
  onPackage(state: State, locator: Locator, packageFs: FakeFS): Promise<[State, null] | null>;
};

export type LinkDefinition<State> = {
  dependencyTreeTraversal?: DependencyTreeTraversal<State>,
};

export interface Linker<State = any> {
  supports(pkg: Package, opts: MinimalLinkOptions): boolean;

  setup(opts: LinkOptions): Promise<LinkDefinition<State>>;
}
