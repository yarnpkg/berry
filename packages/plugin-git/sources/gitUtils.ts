import {execUtils, Configuration}          from '@berry/core';
import {xfs}                               from '@berry/fslib';

export async function clone(repo: string, configuration: Configuration) {
  if (!configuration.get(`enableNetwork`))
    throw new Error(`Network access has been disabled by configuration (${repo})`);

  const directory = await xfs.mktempPromise()
  await execUtils.execvp(`git`, [`clone`, `${repo}`, `${directory}`], {
    cwd: directory,
    env: {
      ...process.env,
      GIT_SSH_COMMAND: `ssh -o BatchMode=yes`,
    },
    strict: true
  });
  return directory;
}
