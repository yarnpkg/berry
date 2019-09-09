import {execUtils, Configuration} from '@yarnpkg/core';
import {xfs}                      from '@yarnpkg/fslib';
import gitUrlParse                from 'git-url-parse';
import semver                     from 'semver';

function makeGitEnvironment() {
  return {
    ...process.env,
    // An option passed to SSH by Git to prevent SSH from asking for data (which would cause installs to hang when the SSH keys are missing)
    GIT_SSH_COMMAND: `ssh -o BatchMode=yes`,
  };
}

export async function lsRemote(repo: string, configuration: Configuration) {
  if (!configuration.get(`enableNetwork`))
    throw new Error(`Network access has been disabled by configuration (${repo})`);

  let res: {stdout: string};
  try {
    res = await execUtils.execvp(`git`, [`ls-remote`, `--refs`, repo], {
      cwd: configuration.startingCwd,
      env: makeGitEnvironment(),
      strict: true,
    });
  } catch (error) {
    console.log(error);
    error.message = `Listing the refs for ${repo} failed`;
    throw error;
  }

  const refs = new Map();

  const matcher = /^([a-f0-9]{40})\t(refs\/[^\n]+)/gm;
  let match;

  while ((match = matcher.exec(res.stdout)) !== null)
    refs.set(match[2], match[1]);

  return refs;
}

export async function resolveUrl(url: string, configuration: Configuration) {
  let repo: string;
  let protocol: string | null;
  let request: string;

  const hashIndex = url.indexOf(`#`);
  if (hashIndex === -1) {
    repo = url;
    protocol = `branch`;
    request = `master`;
  } else {
    repo = url.slice(0, hashIndex);

    const colonIndex = url.indexOf(`:`, hashIndex);
    if (colonIndex === -1) {
      protocol = null;
      request = url.slice(hashIndex + 1);
    } else {
      protocol = url.slice(hashIndex + 1, colonIndex);
      request = url.slice(colonIndex + 1);
    }
  }

  const refs = await lsRemote(repo, configuration);

  switch (protocol) {
    case `commit`:
      return request;
    case `branch`:
      return refs.get(`refs/heads/${request}`);
    case `tag`:
      return refs.get(`refs/tags/${request}`);
    case `semver`: {
      const semverTags = new Map([...refs.entries()].filter(([ref]) => {
        return ref.startsWith(`refs/tags/`);
      }).map<[string | null, string]>(([ref, hash]) => {
        return [semver.valid(ref.slice(10)), hash];
      }).filter(([ref]) => {
        return ref !== null;
      }));

      const candidateSemvers = [...semverTags.keys()];
      const bestVersion = semver.maxSatisfying(candidateSemvers, ``);
    }
    case null: {
      return tryResolve();
    }
  }

  const parsedGitUrl = gitUrlParse(url);
  const repo = parsedGitUrl.href.replace(/#.*/, ``);

  let ref = parsedGitUrl.hash;
  if (!ref)
    ref = `master`;

  let hash: string;

  let refHash = refs.get(ref);
  if (typeof refHash !== `undefined`) {
    hash = `commit:${refHash}`;
  } else {
    let branchHash = refs.get(`refs/heads/${ref}`);
    if (typeof branchHash !== `undefined`) {
      hash = `commit:${branchHash}`;
    } else {
      let tagHash = refs.get(`refs/tags/${ref}`);
      if (typeof tagHash !== `undefined`) {
        hash = `commit:${tagHash}`;
      } else {
        if (semver.validRange(ref)) {
        

        hash = `${ref}`;
      }
    }
  }

  return `${repo}#${hash}`;
}

export async function clone(repo: string, configuration: Configuration) {
  if (!configuration.get(`enableNetwork`))
    throw new Error(`Network access has been disabled by configuration (${repo})`);

  const parsedGitUrl = gitUrlParse(repo);
  const hash = parsedGitUrl.hash;

  // Check if git branch / git commit / git tag was specified.
  let gitUrl = parsedGitUrl.href;
  if (hash)
    // If `hash` was specified, we trim it off to clone the whole repository.
    gitUrl = parsedGitUrl.href.replace(`#${hash}`, ``);

  const directory = await xfs.mktempPromise();

  try {
    await execUtils.execvp(`git`, [`clone`, `${gitUrl}`, `${directory}`], {
      cwd: directory,
      env: makeGitEnvironment(),
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
