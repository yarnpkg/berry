// Note: most of those types are useless for most users. Just check the
// PnpSettings and PnpApi types at the end and you'll be fine.
//
// Apart from that, note that the "Data"-suffixed types are the ones stored
// within the state files (hence why they only use JSON datatypes).

export type PackageLocator = {name: string, reference: string} | {name: null, reference: null};

export type PackageInformation = {packageLocation: string, packageDependencies: Map<string, string | [string, string]>};
export type PackageInformationData = {packageLocation: string, packageDependencies: Array<[string, string | [string, string]]>};

export type PackageStore = Map<string | null, PackageInformation>;
export type PackageStoreData = Array<[string | null, PackageInformationData]>;

export type PackageRegistry = Map<string | null, PackageStore>;
export type PackageRegistryData = Array<[string | null, PackageStoreData]>;

export type LocationBlacklistData = Array<string>;
export type LocationLengthData = Array<number>;

export type SerializedState = {
  ignorePatternData: string | null,
  packageRegistryData: PackageRegistryData,
  locationBlacklistData: LocationBlacklistData,
  locationLengthData: LocationLengthData,
};

export type RuntimeState = {
  basePath: string,
  ignorePattern: RegExp | null,
  packageRegistry: PackageRegistry,
  packageLocatorsByLocations: Map<string, PackageLocator | null>;
  packageLocationLengths: Array<number>,
};

export type PnpSettings = {
  shebang?: string | null,
  ignorePattern?: string | null,
  blacklistedLocations?: Iterable<string>,
  packageRegistry: PackageRegistry,
};

export type PnpApi = {
  VERSIONS: {std: number, [key: string]: number},
  topLevel: {name: null, reference: null},

  getPackageInformation: (locator: PackageLocator) => PackageInformation | null,
  findPackageLocator: (location: string) => PackageLocator | null,

  resolveToUnqualified: (request: string, issuer: string | null, opts?: {considerBuiltins?: boolean}) => string | null,
  resolveUnqualified: (unqualified: string, opts?: {extensions?: Array<string>}) => string,
  resolveRequest: (request: string, issuer: string | null, opts?: {considerBuiltins?: boolean, extensions?: Array<string>}) => string | null,
};
