import {BaseCommand}                                                                      from '@yarnpkg/cli';
import {Cache, Configuration, LocatorHash, Project, IdentHash, StreamReport, MessageName} from '@yarnpkg/core';
import {structUtils}                                                                      from '@yarnpkg/core';
import {Command}                                                                          from 'clipanion';
import * as semver                                                                        from 'semver';


// eslint-disable-next-line arca/no-default-export
export default class DeduplicateCommand extends BaseCommand {
  static usage = Command.Usage({
    category: `Workspace-related commands`,
    description: `Reduces dependencies with overlapping ranges to a smaller set of packages`,
    details: `https://github.com/atlassian/yarn-deduplicate for yarn v2`,
    examples: [],
  });

  @Command.Path(`deduplicate`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project} = await Project.find(configuration, this.context.cwd);

    const deduplicateReport = await StreamReport.start({
      configuration,
      stdout: this.context.stdout,
      includeFooter: false,
    }, async report => {
      report.startTimerSync('deduplication step', () => {
        deduplicate(project, report);
      });
    });

    if (deduplicateReport.hasErrors())
      return deduplicateReport.exitCode();

    const cache = await Cache.find(configuration);
    const installReport = await StreamReport.start({
      configuration,
      stdout: this.context.stdout,
      includeLogs: true,
    }, async (report: StreamReport) => {
      await project.install({cache, report});
    });

    return installReport.exitCode();
  }
}

function deduplicate(project: Project, report: StreamReport) {
  const locatorsByIdent: Map<IdentHash, Set<LocatorHash>> = new Map();
  for (const [descriptorHash, locatorHash] of project.storedResolutions.entries()) {
    const value = locatorHash;
    const descriptor = project.storedDescriptors.get(descriptorHash)!;
    const key = descriptor.identHash;

    const locators = locatorsByIdent.get(key);
    if (locators === undefined) {
      locatorsByIdent.set(key, new Set([value]));
    } else {
      locatorsByIdent.set(key, locators.add(value));
    }
  }

  for (const descriptorHash of project.storedResolutions.keys()) {
    const descriptor = project.storedDescriptors.get(descriptorHash)!;
    const locatorHashes = locatorsByIdent.get(descriptor.identHash)!;

    const semverMatch = descriptor.range.match(/^npm:(.*)$/);
    if (semverMatch === null)
      continue;

    if (locatorHashes !== undefined && locatorHashes.size > 1) {
      const candidates = Array.from(locatorHashes).map(locatorHash => {
        const pkg  = project.storedPackages.get(locatorHash)!;
        if (structUtils.isVirtualLocator(pkg)) {
          const sourceLocator = structUtils.devirtualizeLocator(pkg);
          return project.storedPackages.get(sourceLocator.locatorHash)!;
        }

        return pkg;
      }).filter(sourcePackage => {
        if (sourcePackage.version === null)
          return false;

        return semver.satisfies(sourcePackage.version, semverMatch[1]);
      }).sort((a, b) => {
        return semver.gt(a.version!, b.version!) ? -1: 1;
      });

      if (candidates.length > 1) {
        const newLocatorHash = candidates[0].locatorHash;
        const oldLocatorHash = project.storedResolutions.get(descriptorHash)!;
        const newPkg = project.storedPackages.get(newLocatorHash)!;
        const oldPkg = project.storedPackages.get(oldLocatorHash)!;

        if (structUtils.areLocatorsEqual(oldPkg, newPkg) === false) {
          report.reportInfo(MessageName.UNNAMED, `${structUtils.stringifyDescriptor(descriptor)} can be deduplicated from ${oldPkg.name}@${oldPkg.version} to ${newPkg.name}@${newPkg.version}`);

          project.storedResolutions.set(descriptorHash, newLocatorHash);
        }
      }
    }
  }
}
