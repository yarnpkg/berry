import {NodeFS, ppath, PortablePath}                                                                          from '@berry/fslib';

import {PackageInformation, PackageLocator, PackageStore, RuntimeState, SerializedState} from '../types';

export type HydrateRuntimeStateOptions = {
  basePath: string,
};

export function hydrateRuntimeState(data: SerializedState, {basePath}: HydrateRuntimeStateOptions): RuntimeState {
  const portablePath = NodeFS.toPortablePath(basePath);

  const ignorePattern = data.ignorePatternData !== null
    ? new RegExp(data.ignorePatternData)
    : null;

  const packageRegistry = new Map(data.packageRegistryData.map(([packageName, packageStoreData]) => {
    return [packageName, new Map(packageStoreData.map(([packageReference, packageInformationData]) => {
      return [packageReference, {
        packageLocation: ppath.resolve(portablePath, packageInformationData.packageLocation),
        packageDependencies: new Map(packageInformationData.packageDependencies),
      }] as [string | null, PackageInformation<PortablePath>];
    }))] as [string | null, PackageStore];
  }));

  const packageLocatorsByLocations = new Map(data.locationBlacklistData.map(location => {
    return [location, null] as [PortablePath, PackageLocator | null];
  }));

  for (const [packageName, storeData] of data.packageRegistryData) {
    for (const [packageReference, packageInformationData] of storeData) {
      if ((packageName === null) !== (packageReference === null))
        throw new Error(`Assertion failed: The name and reference should be null, or neither should`);

      // @ts-ignore: TypeScript isn't smart enough to understand the type assertion
      const packageLocator: PackageLocator = {name: packageName, reference: packageReference};

      packageLocatorsByLocations.set(packageInformationData.packageLocation, packageLocator);
    }
  }

  const fallbackExclusionList = new Map(data.fallbackExclusionList.map(([packageName, packageReferences]) => {
    return [packageName, new Set(packageReferences)] as [string, Set<string>];
  }));

  const enableTopLevelFallback = data.enableTopLevelFallback;
  const packageLocationLengths = data.locationLengthData;

  return {
    basePath: portablePath,
    enableTopLevelFallback,
    fallbackExclusionList,
    ignorePattern,
    packageLocationLengths,
    packageLocatorsByLocations,
    packageRegistry,
  };
}
