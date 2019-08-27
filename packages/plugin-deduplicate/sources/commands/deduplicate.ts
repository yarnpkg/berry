import {BaseCommand, WorkspaceRequiredError}                                           from '@yarnpkg/cli';
import {Configuration, LocatorHash, Project, Workspace, IdentHash,Descriptor, Package} from '@yarnpkg/core';
import {DescriptorHash, MessageName, Report, StreamReport}                             from '@yarnpkg/core';
import {miscUtils, structUtils}                                                        from '@yarnpkg/core';
import {Command, UsageError}                                                           from 'clipanion';
import * as semver                                                                     from 'semver';


// eslint-disable-next-line arca/no-default-export
export default class WorkspacesForeachCommand extends BaseCommand {
  static usage = Command.Usage({
    category: `Workspace-related commands`,
    description: `Reduces dependencies with overlapping ranges to a minimal set of packages`,
    details: `https://github.com/atlassian/yarn-deduplicate for yarn v2`,
    examples: [],
  });

  @Command.Path(`deduplicate`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project, workspace: cwdWorkspace} = await Project.find(configuration, this.context.cwd);

    const locatorsByIdent: Map<IdentHash, Set<LocatorHash>> = new Map();
    for (const descriptor of project.storedDescriptors.values()) {
      const value = project.storedResolutions.get(descriptor.descriptorHash)!;
      const key = descriptor.identHash;

      const descriptors = locatorsByIdent.get(key);
      if (descriptors === undefined) {
        locatorsByIdent.set(key, new Set([value]));
      } else {
        locatorsByIdent.set(key, descriptors.add(value));
      }
    }

    for (const [descriptorHash, descriptor] of project.storedDescriptors.entries()) {
      const locators = locatorsByIdent.get(descriptor.identHash);

      if (locators !== undefined && locators.size > 1) {
        const candidates = Array.from(locators).filter(candidateHash => {
          const pkg  = project.storedPackages.get(candidateHash)!

          if (pkg.version === null)
            return false

          const semverMatch = descriptor.range.match(/^npm:(.*)$/);
          if (semverMatch === null)
            return false;

          return semver.satisfies(pkg.version, semverMatch[1])
        }).sort((a, b) => {
          const pkgA  = project.storedPackages.get(a)!
          const pkgB  = project.storedPackages.get(b)!
          return semver.gt(pkgA.version!, pkgB.version!) ? -1: 1;
        });

        if (candidates.length > 1) {
          const newLocator = candidates[0];
          const oldLocator = project.storedResolutions.get(descriptorHash)!

          if (newLocator !== oldLocator) {
            //project.storedResolutions.set(descriptorHash, newLocator);
            const newPkg = project.storedPackages.get(newLocator)!;
            const oldPkg = project.storedPackages.get(oldLocator)!;
            console.log(`${oldPkg.name}@${descriptor.range} -> ${newPkg.name}@${newPkg.version}`)
            //console.log(`${descriptor.name}@${descriptor.range} was ${oldLocator} new ${newLocator} ${newPkg.version}`)
          } else {
            //console.log(`${descriptor.name} already highest`)
          }
        }
      }
    }

    // await project.persistLockfile();
  }
}
