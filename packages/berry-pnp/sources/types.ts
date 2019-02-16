export type PackageLocator = {name: string, reference: string} | {name: null, reference: null};

export type PackageInformation = {packageLocation: string, packageDependencies: Map<string, string>};
export type PackageInformationData = {packageLocation: string, packageDependencies: Array<[string, string]>};

export type PackageStore = Map<string | null, PackageInformation>;
export type PackageStoreData = Array<[string | null, PackageInformationData]>;

export type PackageRegistry = Map<string | null, PackageStore>;
export type PackageRegistryData = Array<[string | null, PackageStoreData]>;

export type LocationBlacklistData = Array<string>;
export type LocationLengthData = Array<number>;

export type PnpSettings = {
  shebang?: string | null,
  ignorePattern?: string | null,
  blacklistedLocations?: Iterable<string>,
  packageRegistry: PackageRegistry,
};

export type RuntimeState = {
  ignorePattern: RegExp | null,
  packageRegistry: PackageRegistry,
  packageLocatorsByLocations: Map<string, PackageLocator>;
  packageLocationLengths: Array<number>
};
