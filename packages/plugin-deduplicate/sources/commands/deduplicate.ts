import {BaseCommand}                                    from '@yarnpkg/cli';
import {Configuration, LocatorHash, Project, IdentHash} from '@yarnpkg/core';
import {structUtils}                                    from '@yarnpkg/core';
import {Command}                                        from 'clipanion';
import * as semver                                      from 'semver';


// eslint-disable-next-line arca/no-default-export
export default class DeduplicateCommand extends BaseCommand {
  static usage = Command.Usage({
    category: `Workspace-related commands`,
    description: `Reduces dependencies with overlapping ranges to a minimal set of packages`,
    details: `https://github.com/atlassian/yarn-deduplicate for yarn v2`,
    examples: [],
  });

  @Command.Path(`deduplicate`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project} = await Project.find(configuration, this.context.cwd);

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
        const candidates = Array.from(locatorHashes).filter(candidateHash => {
          const pkg  = project.storedPackages.get(candidateHash)!;

          if (structUtils.isVirtualLocator(pkg))
            return false;

          if (pkg.version === null)
            return false;

          return semver.satisfies(pkg.version, semverMatch[1]);
        }).sort((a, b) => {
          const pkgA  = project.storedPackages.get(a)!;
          const pkgB  = project.storedPackages.get(b)!;
          return semver.gt(pkgA.version!, pkgB.version!) ? -1: 1;
        });

        if (candidates.length > 1) {
          const newLocatorHash = candidates[0];
          const oldLocatorHash = project.storedResolutions.get(descriptorHash)!;
          const newPkg = project.storedPackages.get(newLocatorHash)!;
          const oldPkg = project.storedPackages.get(oldLocatorHash)!;

          if (structUtils.areLocatorsEqual(oldPkg, newPkg) === false) {
            console.log(`${structUtils.stringifyDescriptor(descriptor)} can be deduplicated from ${oldPkg.name}@${oldPkg.version} to ${newPkg.name}@${newPkg.version}`);

            project.storedResolutions.set(descriptorHash, newLocatorHash);
          }
        }
      }
    }

    await project.persistLockfile();
  }
}
