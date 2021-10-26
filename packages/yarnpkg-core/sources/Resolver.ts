import {FetchOptions}                                 from './Fetcher';
import {Project}                                      from './Project';
import {Report}                                       from './Report';
import {Descriptor, Locator, Package, DescriptorHash} from './types';

export type MinimalResolveOptions = {
  project: Project;
  resolver: Resolver;
};

export type ResolveOptions = MinimalResolveOptions & {
  fetchOptions?: FetchOptions | null;
  report: Report;
};

/**
 * Resolvers are the components that do all the lifting needed in order to
 * produce a lockfile. In clear, they transfom the following:
 *
 *   webpack@^4.0.0
 *
 * into this:
 *
 *   webpack@4.28.0 | dependencies: ajv@^6.1.0, ajv-keyword@^3.1.0, ...
 *
 * In order to do this, they have three different data structures used to
 * represents the various states of the package resolution:
 *
 *   - **Descriptors** contain a package name and a range (for example, using
 *     the previous example, "^4.0.0" would be the range). This range might
 *     point to multiple possible resolutions, so a descriptor alone isn't
 *     enough to fetch the package data from its remote location.
 *
 *   - **Locators** contain a package name and a reference that is used to
 *     both uniquely identify a package and fetch it from its remote location.
 *     To keep using the same example, "4.28.0" would be the reference. Note
 *     that locators have a funny property: they also are valid descriptors!
 *
 *   - **Packages** are locators that made it big. While locators are quite
 *     small, package definitions are relatively fat and contain much more
 *     information than their cousins - for example the dependency list of the
 *     package.
 */

export interface Resolver {
  /**
   * This function must return true if the specified descriptor is meant to be
   * turned into a locator by this resolver. The other functions (except its
   * locator counterpart) won't be called if it returns false.
   *
   * @param descriptor The descriptor that needs to be validated.
   * @param opts The resolution options.
   */
  supportsDescriptor(descriptor: Descriptor, opts: MinimalResolveOptions): boolean;

  /**
   * This function must return true if the specified locator is meant to be
   * turned into a package definition by this resolver. The other functions
   * (except its locator counterpart) won't be called if it returns false.
   *
   * @param locator The locator that needs to be validated.
   * @param opts The resolution options.
   */
  supportsLocator(locator: Locator, opts: MinimalResolveOptions): boolean;

  /**
   * This function indicates whether the package definition for the specified
   * locator must be kept between installs. You typically want to return true
   * for all packages that are cached, but return false for all packages that
   * hydrate packages directly from the filesystem (for example workspaces).
   *
   * Note that even packages returning false are stored within the lockfile!
   * The difference is that when a new install is done, all package definitions
   * that return false will be discarded and resolved again (their potential
   * cache data will be kept, though).
   *
   * @param locator The queried package.
   * @param opts The resolution options.
   */
  shouldPersistResolution(locator: Locator, opts: MinimalResolveOptions): boolean;

  /**
   * This function is called for each dependency present in the dependency list
   * of a package definition. If it returns a new descriptor, this new
   * descriptor will be used
   *
   * Note that `fromLocator` is not necessarily a locator that's supported by
   * the resolver. It simply is the locator of the package that depends on the
   * specified descriptor, regardless who owns it.
   *
   * A typical case where you will want to use this function is when your
   * resolver must support relative paths (for example the `link:` protocol).
   * In this situation, you'll want to store the `fromLocator` in the bound
   * descriptor in order to be able to access the right location during the
   * next steps of the resolution.
   *
   * @param descriptor The depended descriptor.
   * @param fromLocator The dependent locator.
   * @param opts The resolution options.
   */
  bindDescriptor(descriptor: Descriptor, fromLocator: Locator, opts: MinimalResolveOptions): Descriptor;

  /**
   * This function must return a set of other descriptors that must be
   * transformed into locators before the subject descriptor can be transformed
   * into a locator. This is typically only needed for transform packages, as
   * you need to know the original resolution in order to copy it.
   */
  getResolutionDependencies(descriptor: Descriptor, opts: MinimalResolveOptions): Array<Descriptor>;

  /**
   * This function will, given a descriptor, return the list of locators that
   * potentially satisfy it.
   *
   * The returned array must be sorted in such a way that the preferred
   * locators are first. This will cause the resolution algorithm to prioritize
   * them if possible (it doesn't guarantee that they'll end up being used).
   *
   * @param descriptor The source descriptor.
   * @param dependencies The resolution dependencies and their resolutions.
   * @param opts The resolution options.
   */
  getCandidates(descriptor: Descriptor, dependencies: Map<DescriptorHash, Package>, opts: ResolveOptions): Promise<Array<Locator>>;

  /**
   * This function will, given a descriptor and a list of locator references,
   * find out which of the references potentially satisfy the descriptor.
   *
   * This function is different from `getCandidates`, as `getCandidates` will
   * resolve the descriptor into a list of locators (potentially using the network),
   * while `getSatisfying` will statically compute which known references potentially
   * satisfy the target descriptor.
   *
   * Note that the parameter references aren't guaranteed to be supported by
   * the resolver, so they'll probably need to be filtered beforehand.
   *
   * The returned array must be sorted in such a way that the preferred
   * locators are first. This will cause the resolution algorithm to prioritize
   * them if possible (it doesn't guarantee that they'll end up being used).
   *
   * If the operation is unsupported by the resolver (i.e. if it can't be statically
   * determined which references satisfy the target descriptor), `null` should be returned.
   *
   * @param descriptor The target descriptor.
   * @param references The candidate references.
   * @param opts The resolution options.
   */
  getSatisfying(descriptor: Descriptor, references: Array<string>, opts: ResolveOptions): Promise<Array<Locator> | null>;

  /**
   * This function will, given a locator, return the full package definition
   * for the package pointed at.
   *
   * @param locator The source locator.
   * @param opts The resolution options.
   */
  resolve(locator: Locator, opts: ResolveOptions): Promise<Package>;
}
