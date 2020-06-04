import {BaseCommand}                     from '@yarnpkg/cli';
import {Configuration, Project}          from '@yarnpkg/core';
import {PortablePath, npath, ppath, xfs} from '@yarnpkg/fslib';
import {Command, Usage, UsageError}      from 'clipanion';

import {Driver as GitDriver}             from '../drivers/GitDriver';
import {Driver as MercurialDriver}       from '../drivers/MercurialDriver';
import {Hooks}                           from '..';

const ALL_DRIVERS = [
  GitDriver,
  MercurialDriver,
];

// eslint-disable-next-line arca/no-default-export
export default class StageCommand extends BaseCommand {
  @Command.Boolean(`-c,--commit`)
  commit: boolean = false;

  @Command.Boolean(`-r,--reset`)
  reset: boolean = false;

  @Command.Boolean(`-u,--update`)
  update: boolean = false;

  @Command.Boolean(`-n,--dry-run`)
  dryRun: boolean = false;

  static usage: Usage = Command.Usage({
    description: `add all yarn files to your vcs`,
    details: `
      This command will add to your staging area the files belonging to Yarn (typically any modified \`package.json\` and \`.yarnrc.yml\` files, but also linker-generated files, cache data, etc). It will take your ignore list into account, so the cache files won't be added if the cache is ignored in a \`.gitignore\` file (assuming you use Git).

      Running \`--reset\` will instead remove them from the staging area (the changes will still be there, but won't be committed until you stage them back).

      Since the staging area is a non-existent concept in Mercurial, Yarn will always create a new commit when running this command on Mercurial repositories. You can get this behavior when using Git by using the \`--commit\` flag which will directly create a commit.
    `,
    examples: [[
      `Adds all modified project files to the staging area`,
      `yarn stage`,
    ], [
      `Creates a new commit containing all modified project files`,
      `yarn stage --commit`,
    ]],
  });

  @Command.Path(`stage`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project} = await Project.find(configuration, this.context.cwd);

    const {driver, root} = await findDriver(project.cwd);

    const basePaths: Array<PortablePath | null> = [
      configuration.get(`bstatePath`),
      configuration.get(`cacheFolder`),
      configuration.get(`globalFolder`),
      configuration.get(`virtualFolder`),
      configuration.get(`yarnPath`),
    ];

    await configuration.triggerHook((hooks: Hooks) => {
      return hooks.populateYarnPaths;
    }, project, (path: PortablePath | null) => {
      basePaths.push(path);
    });

    const yarnPaths = new Set<PortablePath>();

    // We try to follow symlinks to properly add their targets (for example
    // the cache folder could be a symlink to another folder from the repo)
    for (const basePath of basePaths)
      for (const path of resolveToVcs(root, basePath))
        yarnPaths.add(path);

    const yarnNames: Set<string> = new Set([
      configuration.get(`rcFilename`) as string,
      configuration.get(`lockfileFilename`) as string,
      `package.json`,
    ]);

    const changeList = await driver.filterChanges(root, yarnPaths, yarnNames);
    const commitMessage = await driver.genCommitMessage(root, changeList);

    if (this.dryRun) {
      if (this.commit) {
        this.context.stdout.write(`${commitMessage}\n`);
      } else {
        for (const file of changeList) {
          this.context.stdout.write(`${npath.fromPortablePath(file.path)}\n`);
        }
      }
    } else {
      if (changeList.length === 0) {
        this.context.stdout.write(`No changes found!`);
      } else if (this.commit) {
        await driver.makeCommit(root, changeList, commitMessage);
      } else if (this.reset) {
        await driver.makeReset(root, changeList);
      }
    }
  }
}

async function findDriver(cwd: PortablePath) {
  let driver = null;
  let root: PortablePath | null = null;

  for (const candidate of ALL_DRIVERS) {
    if ((root = await candidate.findRoot(cwd)) !== null) {
      driver = candidate;
      break;
    }
  }

  if (driver === null || root === null)
    throw new UsageError(`No stage driver has been found for your current project`);

  return {driver, root};
}

/**
 * Given two directories, this function will return the location of the second
 * one in the first one after properly resolving symlinks (kind of like a
 * realpath, except that we only resolve the last component of the original
 * path).
 *
 * If the second directory isn't in the first one, this function returns null.
 */

function resolveToVcs(cwd: PortablePath, path: PortablePath | null) {
  const resolved: Array<PortablePath> = [];

  if (path === null)
    return resolved;

  while (true) {
    // If the current element is within the repository, we flag it as something
    // that's part of the Yarn installation
    if (path === cwd || path.startsWith(`${cwd}/`))
      resolved.push(path);

    let stat;
    try {
      stat = xfs.statSync(path);
    } catch (error) {
      // ignore errors
      break;
    }

    // If it's a symbolic link then we also need to also consider its target as
    // part of the Yarn installation (unless it's outside of the repo)
    if (stat.isSymbolicLink()) {
      path = ppath.resolve(ppath.dirname(path), xfs.readlinkSync(path));
    } else {
      break;
    }
  }

  return resolved;
}
