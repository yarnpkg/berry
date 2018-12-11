export type IdentHash = string & { __ident_hash: string };

export interface Ident {
  identHash: IdentHash,
  scope: string | null,
  name: string,
};

export type DescriptorHash = string & { __descriptor_hash: string };

export interface Descriptor extends Ident {
  descriptorHash: DescriptorHash,
  range: string,
};

export type LocatorHash = string & { __locator_hash: string };

export interface Locator extends Ident {
  locatorHash: LocatorHash,
  reference: string,
};

export enum LinkType { HARD = 'hard', SOFT = 'soft' };

export interface Package extends Locator {
  languageName: string,
  linkType: LinkType,

  dependencies: Map<IdentHash, Descriptor>,
  peerDependencies: Map<IdentHash, Descriptor>,
};
