/**
 * Prior work:
 * - https://github.com/atlassian/yarn-deduplicate
 * - https://github.com/eps1lon/yarn-plugin-deduplicate
 */

import {BaseCommand}                                                                                                                                                 from '@yarnpkg/cli';
import {Configuration, Project, ResolveOptions, ThrowReport, Cache, StreamReport, structUtils, IdentHash, LocatorHash, MessageName, Report, DescriptorHash, Locator} from '@yarnpkg/core';
import {Command}                                                                                                                                                     from 'clipanion';
import micromatch                                                                                                                                                    from 'micromatch';
import semver                                                                                                                                                        from 'semver';

// eslint-disable-next-line arca/no-default-export
export default class DeduplicateCommand extends BaseCommand {
  @Command.Rest()
  patterns: Array<string> = [];

  @Command.Boolean(`--check`)
  check: boolean = false;

  @Command.Boolean(`--json`)
  json: boolean = false;

  static usage = Command.Usage({
    description: `deduplicate dependencies with overlapping ranges`,
    details: `
      Duplicates are defined as descriptors with overlapping ranges being resolved and locked to different locators. They are a natural consequence of Yarn's deterministic installs, but they can sometimes pile up and unnecessarily increase the size of your project.

      This command deduplicates dependencies in the current project by reusing (where possible) the locators with the highest versions. This means that dependencies can only be upgraded, never downgraded.

      **Note:** Although it never produces a wrong dependency tree, this command should be used with caution, as it modifies the dependency tree, which can sometimes cause problems when packages specify wrong dependency ranges. It is recommended to also review the changes manually.

      If set, the \`--check\` flag will only report the found duplicates, without persisting the modified dependency tree.

      This command accepts glob patterns as arguments (if valid Idents and supported by [micromatch](https://github.com/micromatch/micromatch)). Make sure to escape the patterns, to prevent your own shell from trying to expand them.
    `,
    examples: [[
      `Deduplicate all packages`,
      `$0 deduplicate`,
    ], [
      `Deduplicate a specific package`,
      `$0 deduplicate lodash`,
    ], [
      `Deduplicate all packages with the \`@babel\` scope`,
      `$0 deduplicate '@babel/'`,
    ], [
      `Check for duplicates (can be used as a CI step)`,
      `$0 deduplicate --check`,
    ]],
  });

  @Command.Path(`deduplicate`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project} = await Project.find(configuration, this.context.cwd);
    const cache = await Cache.find(configuration);

    const deduplicateReport = await StreamReport.start({
      configuration,
      includeFooter: false,
      stdout: this.context.stdout,
      json: this.json,
    }, async report => {
      await deduplicate(project, this.patterns, {cache, report});
    });

    if (this.check) {
      return deduplicateReport.hasWarnings() ? 1 : 0;
    } else {
      const installReport = await StreamReport.start({
        configuration,
        stdout: this.context.stdout,
        json: this.json,
      }, async report => {
        await project.install({cache, report});
      });

      return installReport.exitCode();
    }
  }
}

export interface DeduplicationFactors {
  locatorsByIdent: Map<IdentHash, Set<LocatorHash>>;
}

export function getDeduplicationFactors(project: Project): DeduplicationFactors {
  const locatorsByIdent = new Map<IdentHash, Set<LocatorHash>>();
  for (const [descriptorHash, locatorHash] of project.storedResolutions) {
    const descriptor = project.storedDescriptors.get(descriptorHash);
    if (!descriptor)
      throw new Error(`Assertion failed: The descriptor (${descriptorHash}) should have been registered`);

    if (!locatorsByIdent.has(descriptor.identHash))
      locatorsByIdent.set(descriptor.identHash, new Set());
    locatorsByIdent.get(descriptor.identHash)!.add(locatorHash);
  }

  return {locatorsByIdent};
}

export async function deduplicate(project: Project, patterns: Array<string>, {cache, report}: {cache: Cache, report: Report}) {
  const {configuration} = project;
  const throwReport = new ThrowReport();

  const resolver = configuration.makeResolver();
  const fetcher = configuration.makeFetcher();

  const resolveOptions: ResolveOptions = {
    project,
    resolver,
    report: throwReport,
    fetchOptions: {
      project,
      report: throwReport,
      fetcher,
      cache,
      checksums: project.storedChecksums,
      skipIntegrityCheck: true,
    },
  };

  await report.startTimerPromise(`Deduplication step`, async () => {
    // We deduplicate in multiple passes because deduplicating a package can cause
    // its dependencies - if unused - to be removed from the project.storedDescriptors
    // map, which, in turn, can unlock more deduplication possibilities

    let currentPassIdents: Array<IdentHash> = [];
    let nextPassIdents: Array<IdentHash> = [...project.storedDescriptors.values()].map(({identHash}) => identHash);

    // We cache the resolved candidates to speed up subsequent iterations
    const candidateCache = new Map<DescriptorHash, Array<Locator>>();

    while (nextPassIdents.length > 0) {
      // We resolve the dependency tree between passes to get rid of unused dependencies
      await project.resolveEverything({cache, resolver, report: throwReport, lockfileOnly: false});

      currentPassIdents = nextPassIdents;
      nextPassIdents = [];

      const progress = StreamReport.progressViaCounter(project.storedDescriptors.size);
      report.reportProgress(progress);

      // We can deduplicate descriptors in parallel (which is 4x faster) because,
      // even though we work on the same project instance, we only update their
      // resolutions; race conditions are possible when computing the deduplication
      // factors (the computed best deduplication candidate not being the best anymore),
      // but, because we deduplicate in multiple passes, these problems will solve
      // themselves in the next iterations
      await Promise.all(
        [...project.storedDescriptors.entries()].map(async ([descriptorHash, descriptor]) => {
          try {
            if (structUtils.isVirtualDescriptor(descriptor))
              return;

            if (!currentPassIdents.includes(descriptor.identHash))
              return;

            if (patterns.length && !micromatch.isMatch(structUtils.stringifyIdent(descriptor), patterns))
              return;

            const currentResolution = project.storedResolutions.get(descriptorHash);
            if (!currentResolution)
              return;

            // We only care about resolutions that are stored in the lockfile
            const currentPackage = project.originalPackages.get(currentResolution);
            if (!currentPackage)
              return;

            // No need to try deduplicating packages that are not persisted,
            // because they will be resolved again anyways
            if (!resolver.shouldPersistResolution(currentPackage, resolveOptions))
              return;

            const {locatorsByIdent} = getDeduplicationFactors(project);

            const locators = locatorsByIdent.get(descriptor.identHash);
            if (!locators)
              return;

            // No need to choose when there's only one possibility
            if (locators.size === 1)
              return;

            const sortedLocators = [...locators].sort((a, b) => {
              const aPackage = project.storedPackages.get(a);
              const bPackage = project.storedPackages.get(b);

              if (!aPackage?.version && !bPackage?.version)
                return 0;

              if (!aPackage?.version)
                return -1;

              if (!bPackage?.version)
                return 1;

              return semver.compare(aPackage.version, bPackage.version);
            }).reverse();

            const resolutionDependencies = resolver.getResolutionDependencies(descriptor, resolveOptions);
            const dependencies = new Map(
              resolutionDependencies.map(dependency => {
                const resolution = project.storedResolutions.get(dependency.descriptorHash);
                if (!resolution)
                  throw new Error(`Assertion failed: The resolution (${structUtils.prettyDescriptor(configuration, dependency)}) should have been registered`);

                const pkg = project.storedPackages.get(resolution);
                if (!pkg)
                  throw new Error(`Assertion failed: The package (${resolution}) should have been registered`);

                return [dependency.descriptorHash, pkg] as const;
              })
            );

            let candidates: Array<Locator>;
            if (candidateCache.has(descriptorHash)) {
              candidates = candidateCache.get(descriptorHash)!;
            } else {
              candidates = await resolver.getCandidates(descriptor, dependencies, resolveOptions);
              candidateCache.set(descriptorHash, candidates);
            }

            const updatedResolution = sortedLocators.find(
              locatorHash => candidates.map(({locatorHash}) => locatorHash).includes(locatorHash)
            );
            if (!updatedResolution)
              return;

            // We only care about resolutions that are stored in the lockfile
            const updatedPackage = project.originalPackages.get(updatedResolution);
            if (!updatedPackage)
              return;

            if (updatedResolution === currentResolution)
              return;

            report.reportWarning(
              MessageName.UNNAMED,
              `${
                structUtils.prettyDescriptor(configuration, descriptor)
              } can be deduplicated from ${
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

            project.storedResolutions.set(descriptorHash, updatedResolution);

            // We schedule some idents for the next pass
            nextPassIdents.push(
            // We try deduplicating the current package even further
              descriptor.identHash,
              // We also try deduplicating its dependencies
              ...currentPackage.dependencies.keys(),
            );
          } finally {
            progress.tick();
          }
        })
      );
    }
  });
}
