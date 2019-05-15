import {NativePath, PortablePath, Path} from '@berry/fslib';

// Note: most of those types are useless for most users. Just check the
// PnpSettings and PnpApi types at the end and you'll be fine.
//
// Apart from that, note that the "Data"-suffixed types are the ones stored
// within the state files (hence why they only use JSON datatypes).

export type PackageLocator = {name: string, reference: string} | {name: null, reference: null};

export type PackageInformation<P extends Path> = {packageLocation: P, packageDependencies: Map<string, string | [string, string]>};
export type PackageInformationData<P extends Path> = {packageLocation: P, packageDependencies: Array<[string, string | [string, string]]>};

export type PackageStore = Map<string | null, PackageInformation<PortablePath>>;
export type PackageStoreData = Array<[string | null, PackageInformationData<PortablePath>]>;

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
  basePath: PortablePath,
  ignorePattern: RegExp | null,
  packageRegistry: PackageRegistry,
  packageLocatorsByLocations: Map<PortablePath, PackageLocator | null>;
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

  getPackageInformation: (locator: PackageLocator) => PackageInformation<NativePath> | null,
  findPackageLocator: (location: NativePath) => PackageLocator | null,

  resolveToUnqualified: (request: string, issuer: NativePath | null, opts?: {considerBuiltins?: boolean}) => NativePath | null,
  resolveUnqualified: (unqualified: NativePath, opts?: {extensions?: Array<string>}) => NativePath,
  resolveRequest: (request: string, issuer: NativePath | null, opts?: {considerBuiltins?: boolean, extensions?: Array<string>}) => NativePath | null,
};
