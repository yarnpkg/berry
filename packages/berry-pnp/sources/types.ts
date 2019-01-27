export type PackageInformation = {
  packageLocation: string,
  packageDependencies: Map<string, string>,
};

export type PackageInformationStore = Map<string | null, PackageInformation>;
export type PackageInformationStores = Map<string | null, PackageInformationStore>;

export type LocationBlacklist = Set<string>;

export type PnpSettings = {
  shebang?: string | null,
  ignorePattern?: string | null,
  blacklistedLocations?: LocationBlacklist,
  packageInformationStores: PackageInformationStores,
};
