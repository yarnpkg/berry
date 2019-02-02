import {Project}              from '@berry/core';
import {structUtils}          from '@berry/core';
import {parseSyml}            from '@berry/parsers';
import {existsSync, readFile} from 'fs';
import {promisify}            from 'util';

const readFileP = promisify(readFile);

const IMPORTED_PATTERNS = [
  /https?:\/\/registry\.yarnpkg\.com\/([^\/]+)/,
];

export async function registerLegacyYarnResolutions(project: Project) {
  const lockfilePath = `${project.cwd}/yarn.lock`;

  if (!existsSync(lockfilePath))
    return false;

  const content = await readFileP(lockfilePath, `utf8`);
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
