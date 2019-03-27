import {Configuration, PluginConfiguration, Project} from '@berry/core';
import {NodeFS, xfs}                                 from '@berry/fslib';
import {UsageError}                                  from '@manaflair/concierge';
import {posix}                                       from 'path';
import {Writable}                                    from 'stream';

import {Driver as GitDriver}                         from '../drivers/GitDriver';
import {Driver as MercurialDriver}                   from '../drivers/MercurialDriver';
import {Hooks}                                       from '..';

const ALL_DRIVERS = [
  GitDriver,
  MercurialDriver,
];

export default (concierge: any, pluginConfiguration: PluginConfiguration) => concierge

  .command(`stage [-c,--commit] [-r,--reset] [-u,--update] [-n,--dry-run]`)

  .detail(`
    This command will add to your staging area the files belonging to Yarn (typically any modified package.json, yarnrc files, pnp files, cache data, etc). Running \`--reset\` will instead remove them from the staging area (the changes will still be there, but won't be committed until you stage them back).

    Since the staging area is a non-existent concept in Mercurial, Yarn will always create a new commit when running this command. You can force this behavior when using Git by using the \`--commit\` flag.
  `)

  .example(
    `Adds all modified project files to the staging area`,
    `yarn stage`,
  )

  .example(
    `Creates a new commit containing all modified project files`,
    `yarn stage --commit`,
  )

  .action(async ({cwd, stdout, commit, reset, update, dryRun}: {cwd: string, stdout: Writable, commit: boolean, reset: boolean, update: boolean, dryRun: boolean}) => {
    const configuration = await Configuration.find(cwd, pluginConfiguration);
    const {project} = await Project.find(configuration, cwd);

    let {driver, root} = await findDriver(project.cwd);

    const basePaths: Array<string | null> = [
      configuration.get(`bstatePath`),
      configuration.get(`cacheFolder`),
      configuration.get(`globalFolder`),
      configuration.get(`virtualFolder`),
      configuration.get(`lockfilePath`),
      configuration.get(`yarnPath`),
    ];

    await configuration.triggerHook((hooks: Hooks) => {
      return hooks.populateYarnPaths;
    }, project, (path: string | null) => {
      basePaths.push(path);
    });

    const yarnPaths = new Set();

    // We try to follow symlinks to properly add their targets (for example
    // the cache folder could be a symlink to another folder from the repo)
    for (const basePath of basePaths)
      for (const path of resolveToVcs(root, basePath))
        yarnPaths.add(path);

    const yarnNames: Set<string> = new Set([
      configuration.get(`rcFilename`) as string,
      `package.json`,
    ]);

    const changeList = await driver.filterChanges(root, yarnPaths, yarnNames);

    if (dryRun) {
      for (const file of changeList) {
        stdout.write(`${NodeFS.fromPortablePath(file)}\n`);
      }
    } else {
      if (changeList.length === 0) {
        stdout.write(`No changes found!`);
      } else if (commit) {
        await driver.makeCommit(root, changeList);
      } else if (reset) {
        await driver.makeReset(root, changeList);
      }
    }
  });

async function findDriver(cwd: string) {
  let driver = null;
  let root: string | null = null;

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

function resolveToVcs(cwd: string, path: string | null) {
  const resolved: Array<string> = [];

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
      path = posix.resolve(posix.dirname(path), xfs.readlinkSync(path));
    } else {
      break;
    }
  }

  return resolved;
}
