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

  const packageLocatorsByLocations = new Map<PortablePath, {locator: PhysicalPackageLocator, discardFromLookup: boolean}>();

  const packageRegistry = new Map<string | null, PackageStore>(data.packageRegistryData.map(([packageName, packageStoreData]) => {
    return [packageName, new Map<string | null, PackageInformation<PortablePath>>(packageStoreData.map(([packageReference, packageInformationData]) => {
      if ((packageName === null) !== (packageReference === null))
        throw new Error(`Assertion failed: The name and reference should be null, or neither should`);

      const discardFromLookup = packageInformationData.discardFromLookup ?? false;

      // @ts-expect-error: TypeScript isn't smart enough to understand the type assertion
      const packageLocator: PhysicalPackageLocator = {name: packageName, reference: packageReference};
      const entry = packageLocatorsByLocations.get(packageInformationData.packageLocation);
      if (!entry) {
        packageLocatorsByLocations.set(packageInformationData.packageLocation, {locator: packageLocator, discardFromLookup});
      } else {
        entry.discardFromLookup = entry.discardFromLookup && discardFromLookup;
        if (!discardFromLookup) {
          entry.locator = packageLocator;
        }
      }

      let resolvedPackageLocation: PortablePath | null = null;

      return [packageReference, {
        packageDependencies: new Map(packageInformationData.packageDependencies),
        packagePeers: new Set(packageInformationData.packagePeers),
        linkType: packageInformationData.linkType,
        discardFromLookup,
        // we only need this for packages that are used by the currently running script
        // this is a lazy getter because `ppath.join` has some overhead
        get packageLocation() {
          // We use ppath.join instead of ppath.resolve because:
          // 1) packageInformationData.packageLocation is a relative path when part of the SerializedState
          // 2) ppath.join preserves trailing slashes
          return resolvedPackageLocation || (resolvedPackageLocation = ppath.join(absolutePortablePath, packageInformationData.packageLocation));
        },
      }];
    }))];
  }));

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
    packageLocatorsByLocations,
    packageRegistry,
  };
}
