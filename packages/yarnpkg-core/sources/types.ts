import {PortablePath}                       from '@yarnpkg/fslib';

import {DependencyMeta, PeerDependencyMeta} from './Manifest';

export type IdentHash = string & { __identHash: string };

export interface Ident {
  identHash: IdentHash,
  scope: string | null,
  name: string,
}

export type DescriptorHash = string & { __descriptorHash: string };

export interface Descriptor extends Ident {
  descriptorHash: DescriptorHash,
  range: string,
}

export type LocatorHash = string & { __locatorHash: string };

export interface Locator extends Ident {
  locatorHash: LocatorHash,
  reference: string,
}

export enum LinkType { HARD = `HARD`, SOFT = `SOFT` }

export interface Package extends Locator {
  version: string | null,

  languageName: string,
  linkType: LinkType,

  dependencies: Map<IdentHash, Descriptor>,
  peerDependencies: Map<IdentHash, Descriptor>,

  dependenciesMeta: Map<string, Map<string | null, DependencyMeta>>,
  peerDependenciesMeta: Map<string, PeerDependencyMeta>,

  // While we don't need the binaries during the resolution, keeping them
  // within the lockfile is critical to make `yarn run` fast (otherwise we
  // need to inspect the zip content of every dependency to figure out which
  // binaries they export, which is too slow for a command that might be
  // called at every keystroke)
  bin: Map<string, PortablePath>,
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
  status: PackageExtensionStatus,
  userProvided: boolean,
  parentDescriptor: Descriptor,
  /**
   * @deprecated Use `formatUtils.json(packageExtension, formatUtils.Type.PACKAGE_EXTENSION)` instead
   */
  description: string,
};
