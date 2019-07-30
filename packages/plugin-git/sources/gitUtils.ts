import {execUtils}                                    from '@berry/core';
import {xfs, NodeFS, PortablePath, ppath, Filename}   from '@berry/fslib';

const tmp = require('tmp');

export async function clone(repo: string) {
  const directory = await createTemporaryFolder()
  const {code, stdout} = await execUtils.execvp(`git`, [`clone`, `${repo}`, `${directory}`], {cwd: directory});
  // TODO: Support git clone errors
  return directory;
}

function createTemporaryFolder(name?: Filename): Promise<PortablePath> {
  return new Promise<PortablePath>((resolve, reject) => {
    tmp.dir({unsafeCleanup: true}, (error: any, dirPath: any) => {
      if (error) {
        reject(error);
      } else {
        resolve(dirPath);
      }
    });
  }).then(async dirPath => {
    dirPath = await xfs.realpathPromise(NodeFS.toPortablePath(dirPath));

    if (name) {
      dirPath = ppath.join(dirPath, name as PortablePath);
      await exports.mkdirp(dirPath);
    }

    return dirPath;
  });
};
