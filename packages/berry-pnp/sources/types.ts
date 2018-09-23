export type PackageInformation = {
  packageLocation: string,
  packageDependencies: Map<string, string>,
};

export type PackageInformationStore = Map<string | null, PackageInformation>;
export type PackageInformationStores = Map<string | null, PackageInformationStore>;

export type LocationBlacklist = Set<string>;

export type TemplateReplacements = {[key: string]: string};

export type PnpSettings = {
  packageInformationStores: PackageInformationStores,
  blacklistedLocations: LocationBlacklist,
  replacements: TemplateReplacements,
};
