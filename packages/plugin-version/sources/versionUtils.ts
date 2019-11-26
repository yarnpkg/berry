import {Workspace, Configuration, structUtils, miscUtils, hashUtils} from '@yarnpkg/core';
import {PortablePath, xfs}                                           from '@yarnpkg/fslib';
import {parseSyml}                                                   from '@yarnpkg/parsers';

export async function readDeferredInformations(configuration: Configuration) {
  const path = await configuration.get<PortablePath>(`deferredVersioningPath`);
  if (!xfs.existsSync(path))
    return {__nextVersions: {}, __nonces: {}};

  const content = await xfs.readFilePromise(path, `utf8`);
  const data = parseSyml(content);

  for (const key of Object.keys(data.__nextVersions))
    data.__nextVersions[key] = data.__nextVersions[key][1];

  return data;
}

export async function makeDeferredVersioner(workspace: Workspace, nextVersion: string) {
  const data = await readDeferredInformations(workspace.project.configuration);

  return {
    prepareVersion: () => {
      data.__nextVersions[structUtils.stringifyLocator(workspace.locator)] = nextVersion;
      data.__nonces[structUtils.stringifyLocator(workspace.locator)] = nextVersion;
    },
    commitRequests: async () => {
      let nextFile = `__next_versions:\n`;
      for (const [key, value] of miscUtils.sortMap(Object.entries(data.__nextVersions), ([key]) => key))
        nextFile += `  ${JSON.stringify(key)}: [->, ${JSON.stringify(value)}]\n`;

      nextFile += `## In case of a merge conflict, always keep all your changes\n`;
      nextFile += `## and discard all changes from master. This usually means\n`;
      nextFile += `## that you should only keep the upper part of the conflict.\n`;
      nextFile += `__nonces:\n`;

      const nonce = hashUtils.makeHash(String(Math.random()));
      for (const key of miscUtils.sortMap(Object.entries(data.__nonces), ([key]) => key))
        nextFile += `  ${JSON.stringify(key)}: ${JSON.stringify(nonce)}`;
    },
  };
}
