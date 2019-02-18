import path                                                                              from 'path';

import {PackageInformation, PackageLocator, PackageStore, RuntimeState, SerializedState} from '../types';

export type HydrateRuntimeStateOptions = {
  basePath: string,
};

export function hydrateRuntimeState(data: SerializedState, {basePath}: HydrateRuntimeStateOptions): RuntimeState {
  const ignorePattern = data.ignorePatternData
    ? new RegExp(data.ignorePatternData)
    : null;

  const packageRegistry = new Map(data.packageRegistryData.map(([packageName, packageStoreData]) => {
    return [packageName, new Map(packageStoreData.map(([packageReference, packageInformationData]) => {
      return [packageReference, {
        packageLocation: path.resolve(basePath, packageInformationData.packageLocation),
        packageDependencies: new Map(packageInformationData.packageDependencies),
      }] as [string | null, PackageInformation];
    }))] as [string | null, PackageStore];
  }));

  const packageLocatorsByLocations = new Map(data.locationBlacklistData.map(location => {
    return [location, null] as [string, PackageLocator | null];
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

  const packageLocationLengths = data.locationLengthData;

  return {
    basePath,
    ignorePattern,
    packageRegistry,
    packageLocatorsByLocations,
    packageLocationLengths,
  };
}
