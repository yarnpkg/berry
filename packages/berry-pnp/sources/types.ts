import {NativePath, PortablePath, Path} from '@berry/fslib';

// Note: most of those types are useless for most users. Just check the
// PnpSettings and PnpApi types at the end and you'll be fine.
//
// Apart from that, note that the "Data"-suffixed types are the ones stored
// within the state files (hence why they only use JSON datatypes).

export type PhysicalPackageLocator = {name: string, reference: string};
export type TopLevelPackageLocator = {name: null, reference: null};

export type PackageLocator = PhysicalPackageLocator | TopLevelPackageLocator;

export type PackageInformation<P extends Path> = {packageLocation: P, packageDependencies: Map<string, string | [string, string]>};
export type PackageInformationData<P extends Path> = {packageLocation: P, packageDependencies: Array<[string, string | [string, string]]>};

export type PackageStore = Map<string | null, PackageInformation<PortablePath>>;
export type PackageStoreData = Array<[string | null, PackageInformationData<PortablePath>]>;

export type PackageRegistry = Map<string | null, PackageStore>;
export type PackageRegistryData = Array<[string | null, PackageStoreData]>;

export type LocationBlacklistData = Array<string>;
export type LocationLengthData = Array<number>;

// This is what is stored within the .pnp.meta.json file
export type SerializedState = {
  enableTopLevelFallback: boolean,
  fallbackExclusionList: Array<[string, Array<string>]>,
  ignorePatternData: string | null,
  locationBlacklistData: LocationBlacklistData,
  locationLengthData: LocationLengthData,
  packageRegistryData: PackageRegistryData,
};

// This is what `makeApi` actually consumes
export type RuntimeState = {
  basePath: PortablePath,
  enableTopLevelFallback: boolean,
  fallbackExclusionList: Map<string, Set<string>>,
  ignorePattern: RegExp | null,
  packageLocationLengths: Array<number>,
  packageLocatorsByLocations: Map<PortablePath, PackageLocator | null>;
  packageRegistry: PackageRegistry,
};

// This is what the generation functions take as parameter
export type PnpSettings = {
  // Some locations that are not allowed to make a require call, period
  // (usually the realpath of virtual packages)
  blacklistedLocations?: Iterable<string>,

  // Whether the top-level dependencies should be made available to all the
  // dependency tree as a fallback (default is true)
  enableTopLevelFallback?: boolean,

  // Which packages should never be allowed to use fallbacks, no matter what
  fallbackExclusionList?: Array<PhysicalPackageLocator>,

  // Which paths shouldn't use PnP, even if they would otherwise be detected
  // as being owned by a package (legacy settings used to help people migrate
  // to PnP + workspaces when they weren't using either)
  ignorePattern?: string | null,

  // The set of packages to store within the PnP map
  packageRegistry: PackageRegistry,

  // The shebang to add at the top of the file, can be any string you want (the
  // default value should be enough most of the time)
  shebang?: string | null,
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
