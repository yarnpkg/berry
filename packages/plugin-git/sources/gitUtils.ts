import {execUtils, Configuration}                     from '@berry/core';
import {xfs, NodeFS, PortablePath, ppath, Filename}   from '@berry/fslib';

const tmp = require('tmp');

export async function clone(repo: string, configuration: Configuration) {
  if (!configuration.get(`enableNetwork`))
    throw new Error(`Network access has been disabled by configuration (${repo})`);

  const directory = await createTemporaryFolder()
  const {code, stdout} = await execUtils.execvp(`git`, [`clone`, `${repo}`, `${directory}`], {
    cwd: directory,
    env: {
      ...process.env,
      GIT_SSH_COMMAND: `ssh -o BatchMode=yes`,
    }
  });
  // TODO: Support git clone errors
  return directory;
}

function createTemporaryFolder(): Promise<PortablePath> {
  return new Promise<PortablePath>((resolve, reject) => {
    tmp.dir({unsafeCleanup: true}, (error: Error, dirPath: PortablePath) => {
      if (error) {
        reject(error);
      } else {
        resolve(dirPath);
      }
    });
  }).then(async dirPath => {
    dirPath = await xfs.realpathPromise(NodeFS.toPortablePath(dirPath));
    return dirPath;
  });
};
