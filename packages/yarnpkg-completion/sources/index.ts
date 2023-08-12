import {Configuration} from '@yarnpkg/core';
import {ppath, xfs}    from '@yarnpkg/fslib';

import {getContent}    from './engine';

function getCompletionFolder(configuration: Configuration) {
  return ppath.join(configuration.get(`globalFolder`), `completion`);
}

function getEnginePath(configuration: Configuration) {
  return ppath.join(getCompletionFolder(configuration), `engine.cjs`);
}

export async function setupEngine(configuration: Configuration) {
  const enginePath = getEnginePath(configuration);

  await xfs.mkdirPromise(ppath.dirname(enginePath), {recursive: true});

  await xfs.writeFilePromise(enginePath, await getContent(), {
    mode: 0o755,
  });

  return enginePath;
}

export async function cleanupEngine(configuration: Configuration) {
  const enginePath = getEnginePath(configuration);

  await xfs.unlinkPromise(enginePath);

  return enginePath;
}
