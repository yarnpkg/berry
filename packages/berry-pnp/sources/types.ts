import {NativePath, PortablePath, Path} from '@berry/fslib';

// Note: most of those types are useless for most users. Just check the
// PnpSettings and PnpApi types at the end and you'll be fine.
//
// Apart from that, note that the "Data"-suffixed types are the ones stored
// within the state files (hence why they only use JSON datatypes).

export type PackageLocator = {name: string, reference: string} | {name: null, reference: null};

export type PackageInformation<P extends Path = NativePath> = {packageLocation: P, packageDependencies: Map<string, string | [string, string]>};
export type PackageInformationData<P extends Path = NativePath> = {packageLocation: P, packageDependencies: Array<[string, string | [string, string]]>};

export type PackageStore<P extends Path = NativePath> = Map<string | null, PackageInformation<P>>;
export type PackageStoreData<P extends Path = NativePath> = Array<[string | null, PackageInformationData<P>]>;

export type PackageRegistry<P extends Path = NativePath> = Map<string | null, PackageStore<P>>;
export type PackageRegistryData<P extends Path = NativePath> = Array<[string | null, PackageStoreData<P>]>;

export type LocationBlacklistData = Array<string>;
export type LocationLengthData = Array<number>;

export type SerializedState = {
  ignorePatternData: string | null,
  packageRegistryData: PackageRegistryData<PortablePath>,
  locationBlacklistData: LocationBlacklistData,
  locationLengthData: LocationLengthData,
};

export type RuntimeState = {
  basePath: PortablePath,
  ignorePattern: RegExp | null,
  packageRegistry: PackageRegistry<PortablePath>,
  packageLocatorsByLocations: Map<PortablePath, PackageLocator | null>;
  packageLocationLengths: Array<number>,
};

export type PnpSettings = {
  shebang?: string | null,
  ignorePattern?: string | null,
  blacklistedLocations?: Iterable<string>,
  packageRegistry: PackageRegistry<PortablePath>,
};

export type PnpApi = {
  VERSIONS: {std: number, [key: string]: number},
  topLevel: {name: null, reference: null},

  getPackageInformation: (locator: PackageLocator) => PackageInformation | null,
  findPackageLocator: (location: NativePath) => PackageLocator | null,

  resolveToUnqualified: (request: string, issuer: NativePath | null, opts?: {considerBuiltins?: boolean}) => NativePath | null,
  resolveUnqualified: (unqualified: NativePath, opts?: {extensions?: Array<string>}) => NativePath,
  resolveRequest: (request: string, issuer: NativePath | null, opts?: {considerBuiltins?: boolean, extensions?: Array<string>}) => NativePath | null,
};
