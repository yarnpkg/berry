import {execUtils, Configuration} from '@berry/core';
import {xfs}                      from '@berry/fslib';

import GitUrlParse                from 'git-url-parse';

export async function clone(repo: string, configuration: Configuration) {
  if (!configuration.get(`enableNetwork`))
    throw new Error(`Network access has been disabled by configuration (${repo})`);

  const parsedGitUrl = GitUrlParse(repo);
  const hash = parsedGitUrl.hash

  // Check if git branch / git commit / git tag was specified.
  let gitUrl = parsedGitUrl.href;
  if (hash)
    // If `hash` was specified, we trim it off to clone the whole repository.
    gitUrl = parsedGitUrl.href.replace(`#${hash}`, ``);


  const directory = await xfs.mktempPromise();

  try {
    await execUtils.execvp(`git`, [`clone`, `${gitUrl}`, `${directory}`], {
      cwd: directory,
      env: {
        ...process.env,
        GIT_SSH_COMMAND: `ssh -o BatchMode=yes`, // An option passed to SSH by Git to prevent SSH asking for data and causing installs to hang when the SSH keys are missing.
      },
      strict: true,
    });

    // If `hash` was specified, check out git branch / git commit / git tag to point to the requested revision of the repository.
    if (hash) {
      await execUtils.execvp(`git`, [`checkout`, `${hash}`], {cwd: directory, strict: true});
    }
  } catch (error) {
    error.message = `Cloning the repository from (${gitUrl}) to (${directory}) failed`;
    throw error;
  }


  return directory;
}
