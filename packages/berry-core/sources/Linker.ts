import {FakeFS}           from '@berry/zipfs';

import {Cache}            from './Cache';
import {Project}          from './Project';
import {Package, Locator} from './types';

export type MinimalLinkOptions = {
  project: Project,
};

export type LinkOptions = MinimalLinkOptions & {
};

export type LinkTree = {
  locator: Locator,
  children: Array<LinkTree>,
  inheritedDependencies: Array<string>,
  isHardDependency: boolean,
  hoistedFrom: Array<Array<string>>,
  buildOrder: number,
};

export interface DependencyTreeTraversal<State> {
  /**
   * The following is a high-level description of the logic of the dependency
   * tree traversal: first Berry will traverse the logical dependency tree to
   * find out which linkers support which nodes. Every time it crosses the
   * boundaries between two linkers (for example when a Python package has a
   * Node dependency) it will compute a partial dependency tree that covers the
   * subset of the full tree that's covered by the new linker. This partial
   * dependency tree will then be fed to the `hoist` handler (optional; ignored
   * if unimplemented) which will have the opportunity to rework the tree to its
   * will. The result will then be traversed by Berry, which will call the
   * onRoot and onPackage handlers to install the packages on the disk. Once
   * done, Berry will make a second pass by calling the onLink handler for each
   * relationship between two packages. And finally, once all the onLink
   * handlers have all been called, Berry makes a final pass to call the onBuild
   * handlers for all the packages that reported needing a build step.
   */

  /**
   * Given a tree, must return another tree that's been reworked in a suitable
   * way. Nodes can be removed if needed (for example if two packages must be
   * merged into one), but not added (you cannot use this to dynamically add a
   * dependency to a package).
   *
   * The following characteristics must be met:
   *
   *   - The root cannot change, and will typically not be supported by the
   *     linker (for example a Node package depending on a Node package will
   *     never cause a new tree to be created, but a Python package depending
   *     on a Node package will).
   *
   *   - The tree leaves are expected to remain leaves in the output tree (this
   *     is because the followup linkers will only be called on the leaves).
   *
   *   - The isHardDependency and hoistedFrom properties must be updated to
   *     target the other packages on the tree that depend on the deduplicated
   *     package. The hoistedFrom set may contain unexisting packages - they'll
   *     simply be ignored by the linking mechanism (useful if you need to
   *     prune part of the tree at some point).
   */

  hoist?(tree: LinkTree, opts: LinkOptions): LinkTree;

  /**
   * Called when the linker is asked to manage a new subset of the dependency
   * tree. The expectation is that nothing really happens except preparing the
   * state for the next hooks.
   *
   * The locator is the package that starts the tree, and the targetFs its
   * final location on the disk. Note that the package pointed by the locator
   * will never have been traversed by the linker (otherwise the installer
   * wouldn't have had to create a new tree).
   *
   * This handler has the following characteristics:
   *
   *   - It might be called multiple times with the same linker in the same
   *     path of the dependency tree, for example if a Node dependency of a
   *     Python package itself has a Python dependency
   *
   *   - It might be called multiple times with the same linker and the same
   *     locator, for example if multiple Python packages depend on the same
   *     Node package.
   *
   *   - However, it will never be called multiple times with the same linker
   *     and the same targetFs - multiple Node dependencies belonging to the
   *     same Python package will only result in the onRoot handler being called
   *     once.
   *
   * Must return the initial linker state that will be passed as parameter to
   * the onPackage handler when called on the first-level dependencies.
   */

  onRoot(locator: Locator, targetFs: FakeFS | null): Promise<State>;

  /**
   * Called once for each package in the dependency tree. The expectation is
   * that the content of packageFs will be copied somewhere on the disk where
   * should be its final location (for example the node_modules folder in the
   * case of Node packages).
   *
   * Note that when the function returns packageFs is automatically closed and
   * any access to it (including read-only) will be an undefined behavior.
   */

  onPackage(state: State, locator: Locator, packageFs: FakeFS): Promise<[State, null]>;
};

export type LinkDefinition<State> = {
  dependencyTreeTraversal?: DependencyTreeTraversal<State>,
};

export interface Linker<State = any> {
  supports(pkg: Package, opts: MinimalLinkOptions): boolean;

  setup(opts: LinkOptions): Promise<LinkDefinition<State>>;
}
