import {PortablePath}                       from '@yarnpkg/fslib';

import {DependencyMeta, PeerDependencyMeta} from './Manifest';

export type IdentHash = string & { __ident_hash: string };

export interface Ident {
  identHash: IdentHash,
  scope: string | null,
  name: string,
}

export type DescriptorHash = string & { __descriptor_hash: string };

export interface Descriptor extends Ident {
  descriptorHash: DescriptorHash,
  range: string,
}

export type LocatorHash = string & { __locator_hash: string };

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
