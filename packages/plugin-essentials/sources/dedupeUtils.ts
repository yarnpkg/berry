
import {Project, ResolveOptions, ThrowReport, Resolver, miscUtils, Descriptor, Package, Report, Cache} from '@yarnpkg/core';
import {formatUtils, structUtils, IdentHash, LocatorHash, MessageName, Fetcher, FetchOptions}          from '@yarnpkg/core';
import micromatch                                                                                      from 'micromatch';

export type Algorithm = (project: Project, patterns: Array<string>, opts: {
  resolver: Resolver,
  resolveOptions: ResolveOptions,
  fetcher: Fetcher,
  fetchOptions: FetchOptions,
}) => Promise<Array<Promise<{
  descriptor: Descriptor,
  currentPackage: Package,
  updatedPackage: Package,
} | null>>>;

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

    return Array.from(project.storedDescriptors.values(), async descriptor => {
      if (patterns.length && !micromatch.isMatch(structUtils.stringifyIdent(descriptor), patterns))
        return null;

      const currentResolution = project.storedResolutions.get(descriptor.descriptorHash);
      if (typeof currentResolution === `undefined`)
        throw new Error(`Assertion failed: The resolution (${descriptor.descriptorHash}) should have been registered`);

      // We only care about resolutions that are stored in the lockfile
      // (we shouldn't accidentally try deduping virtual packages)
      const currentPackage = project.originalPackages.get(currentResolution);
      if (typeof currentPackage === `undefined`)
        return null;

      // No need to try deduping packages that are not persisted,
      // they will be resolved again anyways
      if (!resolver.shouldPersistResolution(currentPackage, resolveOptions))
        return null;

      const locators = locatorsByIdent.get(descriptor.identHash);
      if (typeof locators === `undefined`)
        throw new Error(`Assertion failed: The resolutions (${descriptor.identHash}) should have been registered`);

      // No need to choose when there's only one possibility
      if (locators.size === 1)
        return null;

      const references = [...locators].map(locatorHash => {
        const pkg = project.originalPackages.get(locatorHash);
        if (typeof pkg === `undefined`)
          throw new Error(`Assertion failed: The package (${locatorHash}) should have been registered`);

        return pkg.reference;
      });

      const candidates = await resolver.getSatisfying(descriptor, references, resolveOptions);

      const bestCandidate = candidates?.[0];
      if (typeof bestCandidate === `undefined`)
        return null;

      const updatedResolution = bestCandidate.locatorHash;

      const updatedPackage = project.originalPackages.get(updatedResolution);
      if (typeof updatedPackage === `undefined`)
        throw new Error(`Assertion failed: The package (${updatedResolution}) should have been registered`);

      if (updatedResolution === currentResolution)
        return null;

      return {descriptor, currentPackage, updatedPackage};
    });
  },
};

export type DedupeOptions = {
  strategy: Strategy,
  patterns: Array<string>,
  cache: Cache,
  report: Report,
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
            if (dedupe === null)
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
              }`
            );

            report.reportJson({
              descriptor: structUtils.stringifyDescriptor(descriptor),
              currentResolution: structUtils.stringifyLocator(currentPackage),
              updatedResolution: structUtils.stringifyLocator(updatedPackage),
            });

            project.storedResolutions.set(descriptor.descriptorHash, updatedPackage.locatorHash);
          })
          .finally(() => progress.tick())
      )
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
