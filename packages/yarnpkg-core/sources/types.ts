import {PortablePath}                       from '@yarnpkg/fslib';

import {DependencyMeta, PeerDependencyMeta} from './Manifest';

/**
 * Unique hash of a package scope and name.
 *
 * Used as an identifier.
 *
 * This is a `string`, but the type exists to provide type safety.
 *
 * Example: hash of `types/lodash`
 */
export type IdentHash = string & { __identHash: string };

/**
 * An ident is a combination of a scope and name.
 *
 * For example, `@types/node` would result in an Ident with a scope of `types` and a name of `node`.
 */
export interface Ident {
  /**
   * Unique hash of a package scope and name, acts as an identifier.
   */
  identHash: IdentHash,
  /**
   * Scope of the package without `@` prefix (eg. `types`), if it exists.
   */
  scope: string | null,
  /**
   * Name of the package (eg. `node`)
   */
  name: string,
}

/**
 * Unique hash of a package scope, name and version range.
 *
 * Used as an identifier.
 *
 * This is a `string`, but the type exists to provide type safety.
 *
 * Example: hash of `lodash@^1.0.0`
 */
export type DescriptorHash = string & { __descriptorHash: string };

/**
 * A descriptor is a combination of a package name (for example `lodash`) and a package range (for example `^1.0.0`).
 *
 * Descriptors are used to identify a set of packages rather than one unique package.
 */
export interface Descriptor extends Ident {
  /**
   * Unique hash of a package scope, name and version range.
   *
   * Used as an identifier.
   *
   * Example: hash of `lodash@^1.0.0`
   */
  descriptorHash: DescriptorHash,
  /**
   * The range associated with this descriptor. (eg `^1.0.0`)
   */
  range: string,
}

/**
 * Unique hash of package name (for example `lodash`) and a package reference (for example `1.2.3`).
 *
 * Used as an identifier.
 *
 * This is a `string`, but the type exists to provide type safety.
 *
 * Example: hash of `lodash@1.2.3`
 */
export type LocatorHash = string & { __locatorHash: string };

/**
 * A locator is a combination of a package name (for example `lodash`) and a package reference (for example `1.2.3`).
 *
 * Locators are used to identify a single unique package.
 *
 * @remarks interestingly, all valid locators also are valid descriptors
 */
export interface Locator extends Ident {
  /**
   * Unique hash of package name (for example `lodash`) and a package reference (for example `1.2.3`).
   *
   * Used as an identifier.
   *
   * Example: hash of `lodash@1.2.3`
   */
  locatorHash: LocatorHash,

  /**
   * A package reference uniquely identifies a package (for example: `1.2.3`)
   */
  reference: string,
}

/**
 * Describes the type of the file system link for a package.
 */
export enum LinkType {
  /**
   * The package manager owns the location (things within the cache)
   */
  HARD = `HARD`,
  /**
   * The package manager doesn't own the location (symlinks, workspaces, etc)
   */
  SOFT = `SOFT`
}

/**
 * Contains information about a package, such as its version, dependencies, etc.
 */
export interface Package extends Locator {
  /**
   * The version of the package, if available.
   */
  version: string | null,

  /**
   * The language of the package (eg. `node`)
   */
  languageName: string,

  /**
   * Describes the type of the file system link for a package.
   */
  linkType: LinkType,

  /**
   * A map of the package's dependencies.
   */
  dependencies: Map<IdentHash, Descriptor>,
  /**
   * A map of the package's peer dependencies.
   */
  peerDependencies: Map<IdentHash, Descriptor>,

  /**
   * Map with additional information about direct dependencies.
   */
  dependenciesMeta: Map<string, Map<string | null, DependencyMeta>>,

  /**
   * Map with additional information about peer dependencies.
   *
   * The keys are stringified idents, for example: `@scope/name`
   */
  peerDependenciesMeta: Map<string, PeerDependencyMeta>,

  /**
   * `bin` scripts defined by the package
   *
   * While we don't need the binaries during the resolution, keeping them
   * within the lockfile is critical to make `yarn run` fast (otherwise we
   * need to inspect the zip content of every dependency to figure out which
   * binaries they export, which is too slow for a command that might be
   * called at every keystroke)
   */
  bin: Map<string, PortablePath>,
}
