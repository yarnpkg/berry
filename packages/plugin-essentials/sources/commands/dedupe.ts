/**
 * Prior work:
 * - https://github.com/atlassian/yarn-deduplicate
 * - https://github.com/eps1lon/yarn-plugin-deduplicate
 *
 * Goals of the `dedupe` command:
 * - the deduplication algorithms shouldn't depend on semver; they should instead use the resolver `getSatisfying` system
 * - the deduplication should happen concurrently
 *
 * Note: We don't restore the install state because we already have everything we need inside the
 * lockfile. Because of this, we use `project.originalPackages` instead of `project.storedPackages`
 * (which also provides a safe-guard in case virtual descriptors ever make their way into the dedupe algorithm).
 */

import {BaseCommand}                                                                                                        from '@yarnpkg/cli';
import {Configuration, Project, ResolveOptions, ThrowReport, Cache, StreamReport, Resolver, miscUtils, Descriptor, Package} from '@yarnpkg/core';
import {formatUtils, structUtils, IdentHash, LocatorHash, MessageName, Report, Fetcher, FetchOptions}                       from '@yarnpkg/core';
import {Command}                                                                                                            from 'clipanion';
import micromatch                                                                                                           from 'micromatch';
import * as yup                                                                                                             from 'yup';

export type DedupePromise = Promise<{
  descriptor: Descriptor,
  currentPackage: Package,
  updatedPackage: Package,
} | null>;

export type DedupeAlgorithm = (project: Project, patterns: Array<string>, opts: {
  resolver: Resolver,
  resolveOptions: ResolveOptions,
  fetcher: Fetcher,
  fetchOptions: FetchOptions,
}) => Promise<Array<DedupePromise>>;

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

const acceptedStrategies = new Set(Object.values(Strategy));

export const DEDUPE_ALGORITHMS: Record<Strategy, DedupeAlgorithm> = {
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

// eslint-disable-next-line arca/no-default-export
export default class DedupeCommand extends BaseCommand {
  @Command.Rest()
  patterns: Array<string> = [];

  @Command.String(`-s,--strategy`, {description: `The strategy to use when deduping dependencies`})
  strategy: Strategy = Strategy.HIGHEST;

  @Command.Boolean(`-c,--check`, {description: `Exit with exit code 1 when duplicates are found, without persisting the dependency tree`})
  check: boolean = false;

  @Command.Boolean(`--json`, {description: `Format the output as an NDJSON stream`})
  json: boolean = false;

  static schema = yup.object().shape({
    strategy: yup.string().test({
      name: `strategy`,
      message: `\${path} must be one of \${strategies}`,
      params: {strategies: [...acceptedStrategies].join(`, `)},
      test: (strategy: string) => {
        return acceptedStrategies.has(strategy as Strategy);
      },
    }),
  });

  static usage = Command.Usage({
    description: `deduplicate dependencies with overlapping ranges`,
    details: `
      Duplicates are defined as descriptors with overlapping ranges being resolved and locked to different locators. They are a natural consequence of Yarn's deterministic installs, but they can sometimes pile up and unnecessarily increase the size of your project.

      This command dedupes dependencies in the current project using different strategies (only one is implemented at the moment):

      - \`highest\`: Reuses (where possible) the locators with the highest versions. This means that dependencies can only be upgraded, never downgraded. It's also guaranteed that it never takes more than a single pass to dedupe the entire dependency tree.

      **Note:** Even though it never produces a wrong dependency tree, this command should be used with caution, as it modifies the dependency tree, which can sometimes cause problems when packages don't strictly follow semver recommendations. Because of this, it is recommended to also review the changes manually.

      If set, the \`-c,--check\` flag will only report the found duplicates, without persisting the modified dependency tree. If changes are found, the command will exit with a non-zero exit code, making it suitable for CI purposes.

      This command accepts glob patterns as arguments (if valid Idents and supported by [micromatch](https://github.com/micromatch/micromatch)). Make sure to escape the patterns, to prevent your own shell from trying to expand them.

      ### In-depth explanation:

      Yarn doesn't deduplicate dependencies by default, otherwise installs wouldn't be deterministic and the lockfile would be useless. What it actually does is that it tries to not duplicate dependencies in the first place.

      **Example:** If \`foo@^2.3.4\` (a dependency of a dependency) has already been resolved to \`foo@2.3.4\`, running \`yarn add foo@*\`will cause Yarn to reuse \`foo@2.3.4\`, even if the latest \`foo\` is actually \`foo@2.10.14\`, thus preventing unnecessary duplication.

      Duplication happens when Yarn can't unlock dependencies that have already been locked inside the lockfile.

      **Example:** If \`foo@^2.3.4\` (a dependency of a dependency) has already been resolved to \`foo@2.3.4\`, running \`yarn add foo@2.10.14\` will cause Yarn to install \`foo@2.10.14\` because the existing resolution doesn't satisfy the range \`2.10.14\`. This behavior can lead to (sometimes) unwanted duplication, since now the lockfile contains 2 separate resolutions for the 2 \`foo\` descriptors, even though they have overlapping ranges, which means that the lockfile can be simplified so that both descriptors resolve to \`foo@2.10.14\`.
    `,
    examples: [[
      `Dedupe all packages`,
      `$0 dedupe`,
    ], [
      `Dedupe all packages using a specific strategy`,
      `$0 dedupe --strategy highest`,
    ], [
      `Dedupe a specific package`,
      `$0 dedupe lodash`,
    ], [
      `Dedupe all packages with the \`@babel/*\` scope`,
      `$0 dedupe '@babel/*'`,
    ], [
      `Check for duplicates (can be used as a CI step)`,
      `$0 dedupe --check`,
    ]],
  });

  @Command.Path(`dedupe`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project} = await Project.find(configuration, this.context.cwd);
    const cache = await Cache.find(configuration);

    let dedupedPackageCount: number = 0;
    const dedupeReport = await StreamReport.start({
      configuration,
      includeFooter: false,
      stdout: this.context.stdout,
      json: this.json,
    }, async report => {
      dedupedPackageCount = await dedupe({project, strategy: this.strategy, patterns: this.patterns, cache, report});
    });

    if (dedupeReport.hasErrors())
      return dedupeReport.exitCode();

    if (this.check) {
      return dedupedPackageCount ? 1 : 0;
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

export type DedupeSpec = {
  strategy: Strategy,
  project: Project,
  patterns: Array<string>,
  cache: Cache,
  report: Report,
};

export async function dedupe({strategy, project, patterns, cache, report}: DedupeSpec) {
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

    const progress = StreamReport.progressViaCounter(dedupePromises.length);
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
