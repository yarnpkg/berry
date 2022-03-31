import {Project, ResolveOptions, ThrowReport, Resolver, miscUtils, Descriptor, Package, Report, Cache, DescriptorHash} from '@yarnpkg/core';
import {formatUtils, structUtils, IdentHash, LocatorHash, MessageName, Fetcher, FetchOptions}                          from '@yarnpkg/core';
import micromatch                                                                                                      from 'micromatch';

export type PackageUpdate = {
  descriptor: Descriptor;
  currentPackage: Package;
  updatedPackage: Package;
  resolvedPackage: Package;
};

export type Algorithm = (project: Project, patterns: Array<string>, opts: {
  resolver: Resolver;
  resolveOptions: ResolveOptions;
  fetcher: Fetcher;
  fetchOptions: FetchOptions;
}) => Promise<Array<Promise<PackageUpdate>>>;

export enum Strategy {
  /**
   * This strategy dedupes a locator to the best candidate already installed in the project.
   *
   * Because of this, it's guaranteed that:
   * - it never takes more than a single pass to dedupe all dependencies
   * - dependencies are never downgraded
   */
  HIGHEST = `highest`,
}

export const acceptedStrategies = new Set(Object.values(Strategy));

const DEDUPE_ALGORITHMS: Record<Strategy, Algorithm> = {
  highest: async (project, patterns, {resolver, fetcher, resolveOptions, fetchOptions}) => {
    const locatorsByIdent = new Map<IdentHash, Set<LocatorHash>>();
    for (const [descriptorHash, locatorHash] of project.storedResolutions) {
      const descriptor = project.storedDescriptors.get(descriptorHash);
      if (typeof descriptor === `undefined`)
        throw new Error(`Assertion failed: The descriptor (${descriptorHash}) should have been registered`);

      miscUtils.getSetWithDefault(locatorsByIdent, descriptor.identHash).add(locatorHash);
    }

    const deferredMap = new Map<DescriptorHash, miscUtils.Deferred<PackageUpdate>>(
      miscUtils.mapAndFilter(project.storedDescriptors.values(), descriptor => {
        // We only care about resolutions that are stored in the lockfile
        // (we shouldn't accidentally try deduping virtual packages)
        if (structUtils.isVirtualDescriptor(descriptor))
          return miscUtils.mapAndFilter.skip;

        return [descriptor.descriptorHash, miscUtils.makeDeferred()];
      }),
    );

    for (const descriptor of project.storedDescriptors.values()) {
      const deferred = deferredMap.get(descriptor.descriptorHash);
      if (typeof deferred === `undefined`)
        throw new Error(`Assertion failed: The descriptor (${descriptor.descriptorHash}) should have been registered`);

      const currentResolution = project.storedResolutions.get(descriptor.descriptorHash);
      if (typeof currentResolution === `undefined`)
        throw new Error(`Assertion failed: The resolution (${descriptor.descriptorHash}) should have been registered`);

      const currentPackage = project.originalPackages.get(currentResolution);
      if (typeof currentPackage === `undefined`)
        throw new Error(`Assertion failed: The package (${currentResolution}) should have been registered`);

      Promise.resolve().then(async () => {
        const dependencies = resolver.getResolutionDependencies(descriptor, resolveOptions);

        const resolvedDependencies = Object.fromEntries(
          await miscUtils.allSettledSafe(
            Object.entries(dependencies).map(async ([dependencyName, dependency]) => {
              const dependencyDeferred = deferredMap.get(dependency.descriptorHash);
              if (typeof dependencyDeferred === `undefined`)
                throw new Error(`Assertion failed: The descriptor (${dependency.descriptorHash}) should have been registered`);

              const dedupeResult = await dependencyDeferred.promise;
              if (!dedupeResult)
                throw new Error(`Assertion failed: Expected the dependency to have been through the dedupe process itself`);

              return [dependencyName, dedupeResult.updatedPackage];
            }),
          ),
        );

        if (patterns.length && !micromatch.isMatch(structUtils.stringifyIdent(descriptor), patterns))
          return currentPackage;

        // No need to try deduping packages that are not persisted,
        // they will be resolved again anyways
        if (!resolver.shouldPersistResolution(currentPackage, resolveOptions))
          return currentPackage;

        const candidateHashes = locatorsByIdent.get(descriptor.identHash);
        if (typeof candidateHashes === `undefined`)
          throw new Error(`Assertion failed: The resolutions (${descriptor.identHash}) should have been registered`);

        // No need to choose when there's only one possibility
        if (candidateHashes.size === 1)
          return currentPackage;

        const candidates = [...candidateHashes].map(locatorHash => {
          const pkg = project.originalPackages.get(locatorHash);
          if (typeof pkg === `undefined`)
            throw new Error(`Assertion failed: The package (${locatorHash}) should have been registered`);

          return pkg;
        });

        const satisfying = await resolver.getSatisfying(descriptor, resolvedDependencies, candidates, resolveOptions);

        const bestLocator = satisfying.locators?.[0];
        if (typeof bestLocator === `undefined` || !satisfying.sorted)
          return currentPackage;

        const updatedPackage = project.originalPackages.get(bestLocator.locatorHash);
        if (typeof updatedPackage === `undefined`)
          throw new Error(`Assertion failed: The package (${bestLocator.locatorHash}) should have been registered`);

        return updatedPackage;
      }).then(async updatedPackage => {
        const resolvedPackage = await project.preparePackage(updatedPackage, {resolver, resolveOptions});

        deferred.resolve({
          descriptor,
          currentPackage,
          updatedPackage,
          resolvedPackage,
        });
      }).catch(error => {
        deferred.reject(error);
      });
    }

    return [...deferredMap.values()].map(deferred => {
      return deferred.promise;
    });
  },
};

export type DedupeOptions = {
  strategy: Strategy;
  patterns: Array<string>;
  cache: Cache;
  report: Report;
};

export async function dedupe(project: Project, {strategy, patterns, cache, report}: DedupeOptions) {
  const {configuration} = project;
  const throwReport = new ThrowReport();

  const resolver = configuration.makeResolver();
  const fetcher = configuration.makeFetcher();

  const fetchOptions: FetchOptions = {
    cache,
    checksums: project.storedChecksums,
    fetcher,
    project,
    report: throwReport,
    skipIntegrityCheck: true,
    cacheOptions: {
      skipIntegrityCheck: true,
    },
  };
  const resolveOptions: ResolveOptions = {
    project,
    resolver,
    report: throwReport,
    fetchOptions,
  };

  return await report.startTimerPromise(`Deduplication step`, async () => {
    const algorithm = DEDUPE_ALGORITHMS[strategy];
    const dedupePromises = await algorithm(project, patterns, {resolver, resolveOptions, fetcher, fetchOptions});

    const progress = Report.progressViaCounter(dedupePromises.length);
    report.reportProgress(progress);

    let dedupedPackageCount = 0;

    await Promise.all(
      dedupePromises.map(dedupePromise =>
        dedupePromise
          .then(dedupe => {
            if (dedupe === null || dedupe.currentPackage.locatorHash === dedupe.updatedPackage.locatorHash)
              return;

            dedupedPackageCount++;

            const {descriptor, currentPackage, updatedPackage} = dedupe;

            report.reportInfo(
              MessageName.UNNAMED,
              `${
                structUtils.prettyDescriptor(configuration, descriptor)
              } can be deduped from ${
                structUtils.prettyLocator(configuration, currentPackage)
              } to ${
                structUtils.prettyLocator(configuration, updatedPackage)
              }`,
            );

            report.reportJson({
              descriptor: structUtils.stringifyDescriptor(descriptor),
              currentResolution: structUtils.stringifyLocator(currentPackage),
              updatedResolution: structUtils.stringifyLocator(updatedPackage),
            });

            project.storedResolutions.set(descriptor.descriptorHash, updatedPackage.locatorHash);
          })
          .finally(() => progress.tick()),
      ),
    );

    let packages: string;
    switch (dedupedPackageCount) {
      case 0: {
        packages = `No packages`;
      } break;

      case 1: {
        packages = `One package`;
      } break;

      default: {
        packages = `${dedupedPackageCount} packages`;
      }
    }

    const prettyStrategy = formatUtils.pretty(configuration, strategy, formatUtils.Type.CODE);
    report.reportInfo(MessageName.UNNAMED, `${packages} can be deduped using the ${prettyStrategy} strategy`);

    return dedupedPackageCount;
  });
}
