export interface Ident {
  identHash: string,
  scope: string | null,
  name: string,
};

export interface Descriptor extends Ident {
  descriptorHash: string,
  range: string,
};

export interface Locator extends Ident {
  locatorHash: string,
  reference: string,
};

export interface Package extends Locator {
  dependencies: Map<string, Descriptor>,
  peerDependencies: Map<string, Descriptor>,
};
