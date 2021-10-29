import {PortablePath}                       from '@yarnpkg/fslib';

import {DependencyMeta, PeerDependencyMeta} from './Manifest';

/**
 * Unique hash of a package descriptor. Used as key in various places so that
 * two descriptors can be quickly compared.
 */
export type IdentHash = string & { __identHash: string };

/**
 * Combination of a scope and name, bound with a hash suitable for comparisons.
 *
 * Use `parseIdent` to turn ident strings (`@types/node`) into the ident
 * structure ({scope: `types`, name: `node`}), `makeIdent` to create a new one
 * from known parameters, or `stringifyIdent` to retrieve the string as you'd
 * see it in the `dependencies` field.
 */
export interface Ident {
  /**
   * Unique hash of a package scope and name. Used as key in various places,
   * so that two idents can be quickly compared.
   */
  identHash: IdentHash;

  /**
   * Scope of the package, without the `@` prefix (eg. `types`).
   */
  scope: string | null;

  /**
   * Name of the package (eg. `node`).
   */
  name: string;
}

/**
 * Unique hash of a package descriptor. Used as key in various places so that
 * two descriptors can be quickly compared.
 */
export type DescriptorHash = string & { __descriptorHash: string };

/**
 * Descriptors are just like idents (including their `identHash`), except that
 * they also contain a range and an additional comparator hash.
 *
 * Use `parseRange` to turn a descriptor string into this data structure,
 * `makeDescriptor` to create a new one from an ident and a range, or
 * `stringifyDescriptor` to generate a string representation of it.
 */
export interface Descriptor extends Ident {
  /**
   * Unique hash of a package descriptor. Used as key in various places, so
   * that two descriptors can be quickly compared.
   */
  descriptorHash: DescriptorHash;

  /**
   * The range associated with this descriptor. (eg. `^1.0.0`)
   */
  range: string;
}

/**
 * Unique hash of a package locator. Used as key in various places so that
 * two locators can be quickly compared.
 */
export type LocatorHash = string & { __locatorHash: string };

/**
 * Locator are just like idents (including their `identHash`), except that
 * they also contain a reference and an additional comparator hash. They are
 * in this regard very similar to descriptors except that each descriptor may
 * reference multiple valid candidate packages whereas each locators can only
 * reference a single package.
 *
 * This interesting property means that each locator can be safely turned into
 * a descriptor (using `convertLocatorToDescriptor`), but not the other way
 * around (except in very specific cases).
 */
export interface Locator extends Ident {
  /**
   * Unique hash of a package locator. Used as key in various places so that
   * two locators can be quickly compared.
   */
  locatorHash: LocatorHash;

  /**
   * A package reference uniquely identifies a package (eg. `1.2.3`).
   */
  reference: string;
}

/**
 * Describes in which capacity the linkers can manipulate the package sources.
 */
export enum LinkType {
  /**
   * The package manager owns the location (typically things within the cache)
   * and can transform it at will (for instance the PnP linker may decide to
   * unplug those packages).
   */
  HARD = `HARD`,

  /**
   * The package manager doesn't own the location (symlinks, workspaces, etc),
   * so the linkers aren't allowed to do anything with them except use them as
   * they are.
   */
  SOFT = `SOFT`,
}

/**
 * This data structure is a valid locator (so a reference to a unique package)
 * that went through the resolution pipeline in order to extract all the extra
 * metadata stored on the registry. It's typically what you can find stored
 * inside the lockfile.
 */
export interface Package extends Locator {
  /**
   * The version of the package, if available.
   */
  version: string | null;

  /**
   * The "language" of the package (eg. `node`), for use with multi-linkers.
   * Currently experimental; will probably be renamed before stable release.
   */
  languageName: string;

  /**
   * Describes the type of the file system link for a package.
   */
  linkType: LinkType;

  /**
   * A set of constraints indicating whether the package supports the host
   * environment.
   */
  conditions?: string | null;

  /**
   * A map of the package's dependencies. There's no distinction between prod
   * dependencies and dev dependencies, because those have already been merged
   * together during the resolution process.
   */
  dependencies: Map<IdentHash, Descriptor>;

  /**
   * A map of the package's peer dependencies.
   */
  peerDependencies: Map<IdentHash, Descriptor>;

  /**
   * Map with additional information about direct dependencies.
   */
  dependenciesMeta: Map<string, Map<string | null, DependencyMeta>>;

  /**
   * Map with additional information about peer dependencies.
   *
   * The keys are stringified idents, for example: `@scope/name`
   */
  peerDependenciesMeta: Map<string, PeerDependencyMeta>;

  /**
   * All `bin` entries  defined by the package
   *
   * While we don't need the binaries during the resolution, keeping them
   * within the lockfile is critical to make `yarn run` fast (otherwise we
   * need to inspect the zip content of every dependency to figure out which
   * binaries they export, which is too slow for a command that might be
   * called at every keystroke)
   */
  bin: Map<string, PortablePath>;
}

export enum PackageExtensionType {
  Dependency = `Dependency`,
  PeerDependency = `PeerDependency`,
  PeerDependencyMeta = `PeerDependencyMeta`,
}

export enum PackageExtensionStatus {
  Inactive = `inactive`,
  Redundant = `redundant`,
  Active = `active`,
}

export type PackageExtension = (
  | {type: PackageExtensionType.Dependency, descriptor: Descriptor}
  | {type: PackageExtensionType.PeerDependency, descriptor: Descriptor}
  | {type: PackageExtensionType.PeerDependencyMeta, selector: string, key: keyof PeerDependencyMeta, value: any}
) & {
  status: PackageExtensionStatus;
  userProvided: boolean;
  parentDescriptor: Descriptor;
};
