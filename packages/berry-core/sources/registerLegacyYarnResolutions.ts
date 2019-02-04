import {parseSyml}            from '@berry/parsers';
import {xfs}                  from '@berry/fslib';

import {Project}              from './Project';
import * as structUtils       from './structUtils';

const IMPORTED_PATTERNS = [
  /https?:\/\/registry\.yarnpkg\.com\/([^\/]+)/,
];

/**
 * This function tries to load the resolutions from a v1 lockfile and registers
 * aliases for each of them. It's quite crude, but should be pretty effective
 * in most cases.
 * 
 * It might happens that some pattern in the v1 lockfile isn't covered by the
 * matchers in this file. If it happens, just write an ugly converter and open
 * a PR. Thanks!
 * 
 * Note: This function is instantly deprecated. It might very well be moved
 * into a plugin starting from Yarn v3 (which isn't scheduled yet). Don't
 * forget to migrate your lockfiles! 
 */

export async function registerLegacyYarnResolutions(project: Project) {
  const lockfilePath = `${project.cwd}/yarn.lock`;

  if (!xfs.existsSync(lockfilePath))
    return false;

  const content = await xfs.readFilePromise(lockfilePath, `utf8`);
  const parsed = parseSyml(content);

  for (const key of Object.keys(parsed)) {
    const descriptor = structUtils.tryParseDescriptor(key);

    if (!descriptor)
      continue;
    
    const {version, resolved} = (parsed as any)[key];
    
    if (!IMPORTED_PATTERNS.some(pattern => pattern.test(resolved)))
      continue;
    
    const alias = structUtils.makeDescriptor(descriptor, version);

    project.storedDescriptors.set(descriptor.descriptorHash, descriptor);
    project.storedDescriptors.set(alias.descriptorHash, alias);

    project.resolutionAliases.set(descriptor.descriptorHash, alias.descriptorHash);
  }

  return true;
}
