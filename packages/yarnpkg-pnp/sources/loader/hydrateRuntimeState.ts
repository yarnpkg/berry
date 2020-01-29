import {PortablePath, npath, ppath}                                                      from '@yarnpkg/fslib';

import {PackageInformation, PackageLocator, PackageStore, RuntimeState, SerializedState} from '../types';

export type HydrateRuntimeStateOptions = {
  basePath: string,
};

export function hydrateRuntimeState(data: SerializedState, {basePath}: HydrateRuntimeStateOptions): RuntimeState {
  const portablePath = npath.toPortablePath(basePath);

  const ignorePattern = data.ignorePatternData !== null
    ? new RegExp(data.ignorePatternData)
    : null;

  const packageRegistry = new Map(data.packageRegistryData.map(([packageName, packageStoreData]) => {
    return [packageName, new Map(packageStoreData.map(([packageReference, packageInformationData]) => {
      return [packageReference, {
        packageLocation: ppath.resolve(portablePath, packageInformationData.packageLocation),
        packageDependencies: new Map(packageInformationData.packageDependencies),
        packagePeers: new Set(packageInformationData.packagePeers),
        linkType: packageInformationData.linkType,
        discardFromLookup: packageInformationData.discardFromLookup || false,
      }] as [string | null, PackageInformation<PortablePath>];
    }))] as [string | null, PackageStore];
  }));

  const packageLocatorsByLocations = new Map<PortablePath, PackageLocator | null>();
  const packageLocationLengths = new Set<number>();

  for (const [packageName, storeData] of data.packageRegistryData) {
    for (const [packageReference, packageInformationData] of storeData) {
      if ((packageName === null) !== (packageReference === null))
        throw new Error(`Assertion failed: The name and reference should be null, or neither should`);

      if (packageInformationData.discardFromLookup)
        continue;

      // @ts-ignore: TypeScript isn't smart enough to understand the type assertion
      const packageLocator: PackageLocator = {name: packageName, reference: packageReference};
      packageLocatorsByLocations.set(packageInformationData.packageLocation, packageLocator);

      packageLocationLengths.add(packageInformationData.packageLocation.length);
    }
  }

  for (const location of data.locationBlacklistData)
    packageLocatorsByLocations.set(location, null);

  const fallbackExclusionList = new Map(data.fallbackExclusionList.map(([packageName, packageReferences]) => {
    return [packageName, new Set(packageReferences)] as [string, Set<string>];
  }));

  const dependencyTreeRoots = data.dependencyTreeRoots;
  const enableTopLevelFallback = data.enableTopLevelFallback;

  return {
    basePath: portablePath,
    dependencyTreeRoots,
    enableTopLevelFallback,
    fallbackExclusionList,
    ignorePattern,
    packageLocationLengths: [...packageLocationLengths].sort((a, b) => b - a),
    packageLocatorsByLocations,
    packageRegistry,
  };
}
