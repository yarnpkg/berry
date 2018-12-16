import {FakeFS}                       from '@berry/zipfs';

import {Cache}                        from './Cache';
import {FetchResult}                  from './Fetcher';
import {Project}                      from './Project';
import {IdentHash}                    from './types';
import {Descriptor, Package, Locator} from './types';

export type MinimalLinkOptions = {
  project: Project,
};

export type LinkOptions = MinimalLinkOptions & {
};

export type LinkTree = {
  /**
   * The locator of the package represented by this node.
   */

  locator: Locator,

  /**
   * The children nodes for the current one. Typically one for each dependency,
   * including peer dependencies (because they'll have been resolved into actual
   * dependencies before the linker was initialized).
   */

  children: Array<LinkTree>,

  /**
   * The list of dependencies that the node relies on from its ancestors. This
   * typically is the set of peer dependencies, plus any package that would
   * cause an infinite loop if it was represented as a proper children. For
   * example, in a case of A -> B -> A, B will have an inherited dependencies
   * on A in order to break the loop.
   */

  inheritedDependencies: Array<IdentHash>,

  /**
   * Indicates whether the parent of the node has a hard dependency on the
   * current node. It always equals true, unless the hoister manipulates the
   * tree (in which case it's the hoister responsibility to keep it accurate).
   */

  isHardDependency: boolean,

  /**
   * Indicates whether the node is supported by the current linker. Packages
   * that aren't supported typically shouldn't be hoisted outside of their
   * parent package.
   */

  isSupportedNode: boolean,

  /**
   * Represents the list of nodes that had the current node as hard dependency
   * at some point in the process. Used in order to link them together after
   * they've been installed on the disk.
   */

  hoistedFrom: Array<LinkTree>,

  /**
   * The higher the number, the sooner its build steps should be executed.
   * Additionally, only nodes with an identical build order may be executed
   * concurrently. By default the tree is numbered per depth - this should be
   * a safe default for most use case, and we advise to preserve it even when
   * hoisting packages around.
   */

  buildOrder: number,
};

export interface PackageListTraversal<State> {
  /**
   * Called once for each package in the dependency tree.
   */

  onPackageMap(packageMap: Map<Locator, Package>, targetFs: FakeFS, api: {
    fetchLocator: (locator: Locator) => Promise<FetchResult>,
    resolveDescriptor: (descriptor: Descriptor) => Promise<Locator>,
  }): Promise<void>;
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
   * Returns true if the traversal is supported by the linker for the given
   * node. Some linkers don't support every type of node (for example, the
   * Node linker doesn't support traversing soft dependencies; it doesn't
   * have any way to express their dependencies through symlinks).
   *
   * It is advised to log a warning when you return false, but only if it's the
   * first time you've reported this warning.
   */

  supportsTraversal?(pkg: Package, opts: LinkOptions): boolean;

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

  onRoot(locator: Locator, targetFs: FakeFS): Promise<State>;

  /**
   * Called once for each package in the dependency tree. The expectation is
   * that the content of packageFs will be copied somewhere on the disk where
   * should be its final location (for example the node_modules folder in the
   * case of Node packages).
   *
   * Note that when the function returns packageFs is automatically closed and
   * any access to it (including read-only) will be an undefined behavior.
   */

  onPackage(state: State, pkg: Package, packageFs: FakeFS): Promise<[State, null]>;
};

export type LinkDefinition<State> = {
  /**
   * This hook is called the first time the linker is initialized, and is called
   * with the full set of packages from the dependency tree - including those
   * that might not be supported by the plugin.
   *
   * Example: The Plug'n'Play linker would use this hook in order to generate
   * the .pnp.js file.
   */

  packageMapTraversal?: PackageListTraversal<State>,

  /**
   * This hook is called once for each dependency tree in the project - whether
   * they are a workspace base or a frontier between linkers.
   *
   * Example: The Node linker would use this hook in order to build the
   * filesystem hierarchy of the node_modules folder.
   */

  dependencyTreeTraversal?: DependencyTreeTraversal<State>,
};

export interface Linker<State = {targetFs: FakeFS}> {
  supports(pkg: Package, opts: MinimalLinkOptions): boolean;

  setup(opts: LinkOptions): Promise<LinkDefinition<State>>;
}
