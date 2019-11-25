import {Configuration, Locator, execUtils, structUtils} from '@yarnpkg/core';
import {npath, xfs}                                     from '@yarnpkg/fslib';
import semver                                           from 'semver';

function makeGitEnvironment() {
  return {
    ...process.env,
    // An option passed to SSH by Git to prevent SSH from asking for data (which would cause installs to hang when the SSH keys are missing)
    GIT_SSH_COMMAND: `ssh -o BatchMode=yes`,
  };
}

const gitPatterns = [
  /^git:/,
  /^git\+ssh:/,
  /^(?:git\+)?https?:[^#]+\/[^#]+\.git(?:#.*)?$/,
  /^git@[^#]+\/[^#]+\.git(?:#.*)?$/,
  /^(?:github:|https:\/\/github\.com\/)?([a-zA-Z\d](?:[a-zA-Z\d]|-(?=[a-zA-Z\d]))+)\/([a-zA-Z\d](?:[a-zA-Z\d]|-(?=[a-zA-Z\d]))+)(?:#.*)?$/,
];

/**
 * Determines whether a given url is a valid github git url via regex
 */
export function isGitUrl(url: string): boolean {
  return url ? gitPatterns.some(pattern => !!url.match(pattern)) : false;
}

export function splitRepoUrl(url: string) {
  let repo: string;
  let protocol: string | null;
  let request: string;

  const hashIndex = url.indexOf(`#`);
  if (hashIndex === -1) {
    repo = url;
    protocol = `head`;
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

  return {
    repo,
    treeish: {protocol, request},
  };
}

export function normalizeRepoUrl(url: string) {
  // "git+https://" isn't an actual Git protocol. It's just a way to
  // disambiguate that this URL points to a Git repository.
  url = url.replace(/^git\+https:/, `https:`);

  // We support this as an alias to Github repositories
  url = url.replace(/^(?:github:|https:\/\/github\.com\/)?([a-zA-Z\d](?:[a-zA-Z\d]|-(?=[a-zA-Z\d]))+)\/([a-zA-Z\d](?:[a-zA-Z\d]|-(?=[a-zA-Z\d]))+)(#.*)?$/, `https://github.com/$1/$2.git$3`);

  return url;
}

export function normalizeLocator(locator: Locator) {
  return structUtils.makeLocator(locator, normalizeRepoUrl(locator.reference));
}

export async function lsRemote(repo: string, configuration: Configuration) {
  if (!configuration.get(`enableNetwork`))
    throw new Error(`Network access has been disabled by configuration (${repo})`);

  let res: {stdout: string};
  try {
    res = await execUtils.execvp(`git`, [`ls-remote`, `--refs`, normalizeRepoUrl(repo)], {
      cwd: configuration.startingCwd,
      env: makeGitEnvironment(),
      strict: true,
    });
  } catch (error) {
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
  const {repo, treeish: {protocol, request}} = splitRepoUrl(url);
  const refs = await lsRemote(repo, configuration);

  const resolve = (protocol: string | null, request: string): string => {
    switch (protocol) {
      case `commit`: {
        if (!request.match(/^[a-f0-9]{40}$/))
          throw new Error(`Invalid commit hash`);

        return `commit:${request}`;
      }

      case `head`: {
        const head = refs.get(`refs/heads/${request}`);
        if (typeof head === `undefined`)
          throw new Error(`Unknown head ("${request}")`);

        return `commit:${head}`;
      }

      case `tag`: {
        const tag = refs.get(`refs/tags/${request}`);
        if (typeof tag === `undefined`)
          throw new Error(`Unknown tag ("${request}")`);

        return `commit:${tag}`;
      }

      case `semver`: {
        if (!semver.validRange(request))
          throw new Error(`Invalid range ("${request}")`);

        const semverTags = new Map([...refs.entries()].filter(([ref]) => {
          return ref.startsWith(`refs/tags/`);
        }).map<[semver.SemVer | null, string]>(([ref, hash]) => {
          return [semver.parse(ref.slice(10)), hash];
        }).filter((entry): entry is [semver.SemVer, string] => {
          return entry[0] !== null;
        }));

        const bestVersion = semver.maxSatisfying([...semverTags.keys()], request);
        if (bestVersion === null)
          throw new Error(`No matching range ("${request}")`);

        return `commit:${semverTags.get(bestVersion)}`;
      }

      case null: {
        let result: string | null;

        if ((result = tryResolve(`commit`, request)) !== null)
          return result;
        if ((result = tryResolve(`tag`, request)) !== null)
          return result;
        if ((result = tryResolve(`head`, request)) !== null)
          return result;

        if (request.match(/^[a-f0-9]+$/)) {
          throw new Error(`Couldn't resolve "${request}" as either a commit, a tag, or a head - if a commit, use the 40-characters commit hash`);
        } else {
          throw new Error(`Couldn't resolve "${request}" as either a commit, a tag, or a head`);
        }
      }

      default: {
        throw new Error(`Invalid Git resolution protocol ("${protocol}")`);
      }
    }
  };

  const tryResolve = (protocol: string | null, request: string): string | null => {
    try {
      return resolve(protocol, request);
    } catch (err) {
      return null;
    }
  };

  return `${repo}#${resolve(protocol, request)}`;
}

export async function clone(url: string, configuration: Configuration) {
  if (!configuration.get(`enableNetwork`))
    throw new Error(`Network access has been disabled by configuration (${url})`);

  const {repo, treeish: {protocol, request}} = splitRepoUrl(url);
  if (protocol !== `commit`)
    throw new Error(`Invalid treeish protocol when cloning`);

  const directory = await xfs.mktempPromise();
  const execOpts = {cwd: directory, env: makeGitEnvironment(), strict: true};

  try {
    await execUtils.execvp(`git`, [`clone`, `${normalizeRepoUrl(repo)}`, npath.fromPortablePath(directory)], execOpts);
    await execUtils.execvp(`git`, [`checkout`, `${request}`], execOpts);
  } catch (error) {
    error.message = `Repository clone failed`;
    throw error;
  }

  return directory;
}
