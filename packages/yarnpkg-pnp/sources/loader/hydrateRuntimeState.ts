import {PortablePath, npath, ppath}                                                              from '@yarnpkg/fslib';

import {PackageInformation, PackageStore, RuntimeState, SerializedState, PhysicalPackageLocator} from '../types';

export type HydrateRuntimeStateOptions = {
  basePath: string,
};

export function hydrateRuntimeState(data: SerializedState, {basePath}: HydrateRuntimeStateOptions): RuntimeState {
  const portablePath = npath.toPortablePath(basePath);
  const absolutePortablePath = ppath.resolve(portablePath);

  const ignorePattern = data.ignorePatternData !== null
    ? new RegExp(data.ignorePatternData)
    : null;

  const packageLocatorsByLocations = new Map<PortablePath, PhysicalPackageLocator | null>();
  const packageLocationLengths = new Set<number>();

  const packageRegistry = new Map(data.packageRegistryData.map(([packageName, packageStoreData]) => {
    return [packageName, new Map(packageStoreData.map(([packageReference, packageInformationData]) => {
      if ((packageName === null) !== (packageReference === null))
        throw new Error(`Assertion failed: The name and reference should be null, or neither should`);

      if (!packageInformationData.discardFromLookup) {
        // @ts-expect-error: TypeScript isn't smart enough to understand the type assertion
        const packageLocator: PhysicalPackageLocator = {name: packageName, reference: packageReference};
        packageLocatorsByLocations.set(packageInformationData.packageLocation, packageLocator);

        packageLocationLengths.add(packageInformationData.packageLocation.length);
      }

      return [packageReference, {
        // The packageLocation is relative and starts with `./`
        // inlined because this is more performant than `ppath.join`
        packageLocation: `${absolutePortablePath}/${packageInformationData.packageLocation.slice(2)}`,
        packageDependencies: new Map(packageInformationData.packageDependencies),
        packagePeers: new Set(packageInformationData.packagePeers),
        linkType: packageInformationData.linkType,
        discardFromLookup: packageInformationData.discardFromLookup || false,
      }] as [string | null, PackageInformation<PortablePath>];
    }))] as [string | null, PackageStore];
  }));

  for (const location of data.locationBlacklistData)
    packageLocatorsByLocations.set(location, null);

  const fallbackExclusionList = new Map(data.fallbackExclusionList.map(([packageName, packageReferences]) => {
    return [packageName, new Set(packageReferences)] as [string, Set<string>];
  }));

  const fallbackPool = new Map(data.fallbackPool);

  const dependencyTreeRoots = data.dependencyTreeRoots;
  const enableTopLevelFallback = data.enableTopLevelFallback;

  return {
    basePath: portablePath,
    dependencyTreeRoots,
    enableTopLevelFallback,
    fallbackExclusionList,
    fallbackPool,
    ignorePattern,
    packageLocationLengths: [...packageLocationLengths].sort((a, b) => b - a),
    packageLocatorsByLocations,
    packageRegistry,
  };
}
