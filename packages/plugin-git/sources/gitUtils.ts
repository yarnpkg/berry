import {Configuration, Locator, execUtils, structUtils, httpUtils, semverUtils} from '@yarnpkg/core';
import {npath, xfs}                                                             from '@yarnpkg/fslib';
import GitUrlParse                                                              from 'git-url-parse';
import querystring                                                              from 'querystring';
import semver                                                                   from 'semver';
import urlLib                                                                   from 'url';

function makeGitEnvironment() {
  return {
    ...process.env,
    // An option passed to SSH by Git to prevent SSH from asking for data (which would cause installs to hang when the SSH keys are missing)
    GIT_SSH_COMMAND: `ssh -o BatchMode=yes`,
  };
}

const gitPatterns = [
  /^ssh:/,
  /^git(?:\+[^:]+)?:/,

  // `git+` is optional, `.git` is required
  /^(?:git\+)?https?:[^#]+\/[^#]+(?:\.git)(?:#.*)?$/,

  /^git@[^#]+\/[^#]+\.git(?:#.*)?$/,

  /^(?:github:|https:\/\/github\.com\/)?(?!\.{1,2}\/)([a-zA-Z._0-9-]+)\/(?!\.{1,2}(?:#|$))([a-zA-Z._0-9-]+?)(?:\.git)?(?:#.*)?$/,
  // GitHub `/tarball/` URLs
  /^https:\/\/github\.com\/(?!\.{1,2}\/)([a-zA-Z0-9._-]+)\/(?!\.{1,2}(?:#|$))([a-zA-Z0-9._-]+?)\/tarball\/(.+)?$/,
];

export enum TreeishProtocols {
  Commit = `commit`,
  Head = `head`,
  Tag = `tag`,
  Semver = `semver`,
}

/**
 * Determines whether a given url is a valid github git url via regex
 */
export function isGitUrl(url: string): boolean {
  return url ? gitPatterns.some(pattern => !!url.match(pattern)) : false;
}

export type RepoUrlParts = {
  repo: string;
  treeish: {
    protocol: TreeishProtocols | string | null,
    request: string,
  },
  extra: {
    [key: string]: string,
  },
};

export function splitRepoUrl(url: string): RepoUrlParts {
  url = normalizeRepoUrl(url);

  const hashIndex = url.indexOf(`#`);
  if (hashIndex === -1) {
    return {
      repo: url,
      treeish: {
        protocol: TreeishProtocols.Head,
        request: `HEAD`,
      },
      extra: {},
    };
  }

  const repo = url.slice(0, hashIndex);
  const subsequent = url.slice(hashIndex + 1);

  // New-style: "#commit=abcdef&workspace=foobar"
  if (subsequent.match(/^[a-z]+=/)) {
    const extra = querystring.parse(subsequent);

    for (const [key, value] of Object.entries(extra))
      if (typeof value !== `string`)
        throw new Error(`Assertion failed: The ${key} parameter must be a literal string`);

    const requestedProtocol = Object.values(TreeishProtocols).find(protocol => {
      return Object.prototype.hasOwnProperty.call(extra, protocol);
    });

    let protocol: TreeishProtocols;
    let request: string;

    if (typeof requestedProtocol !== `undefined`) {
      protocol = requestedProtocol;
      request = extra[requestedProtocol]! as string;
    } else {
      protocol = TreeishProtocols.Head;
      request = `HEAD`;
    }

    for (const key of Object.values(TreeishProtocols))
      delete extra[key];

    return {
      repo,
      treeish: {protocol, request},
      extra: extra as {
        [key: string]: string,
      },
    };
  } else {
    // Old-style: "#commit:abcdef" or "#abcdef"
    const colonIndex = subsequent.indexOf(`:`);

    let protocol: string | null;
    let request: string;

    if (colonIndex === -1) {
      protocol = null;
      request = subsequent;
    } else {
      protocol = subsequent.slice(0, colonIndex);
      request = subsequent.slice(colonIndex + 1);
    }

    return {
      repo,
      treeish: {protocol, request},
      extra: {},
    };
  }
}

export function normalizeRepoUrl(url: string, {git = false}: {git?: boolean} = {}) {
  // "git+https://" isn't an actual Git protocol. It's just a way to
  // disambiguate that this URL points to a Git repository.
  url = url.replace(/^git\+https:/, `https:`);

  // We support this as an alias to GitHub repositories
  url = url.replace(/^(?:github:|https:\/\/github\.com\/)?(?!\.{1,2}\/)([a-zA-Z0-9._-]+)\/(?!\.{1,2}(?:#|$))([a-zA-Z0-9._-]+?)(?:\.git)?(#.*)?$/, `https://github.com/$1/$2.git$3`);

  // We support GitHub `/tarball/` URLs
  url = url.replace(/^https:\/\/github\.com\/(?!\.{1,2}\/)([a-zA-Z0-9._-]+)\/(?!\.{1,2}(?:#|$))([a-zA-Z0-9._-]+?)\/tarball\/(.+)?$/, `https://github.com/$1/$2.git#$3`);

  if (git) {
    // The `git+` prefix doesn't mean anything at all for Git
    url = url.replace(/^git\+([^:]+):/, `$1:`);

    // The `ssh://` prefix should be removed because so URLs won't work in Git:
    //   ssh://git@github.com:yarnpkg/berry.git
    //   git@github.com/yarnpkg/berry.git
    // Git only allows:
    //   git@github.com:yarnpkg/berry.git (no ssh)
    //   ssh://git@github.com/yarnpkg/berry.git (no colon)
    // So we should cut `ssh://`, but only in URLs that contain colon after the hostname

    let parsedUrl: urlLib.UrlWithStringQuery | null;
    try {
      parsedUrl = urlLib.parse(url);
    } catch {
      parsedUrl = null;
    }

    if (parsedUrl && parsedUrl.protocol === `ssh:` && parsedUrl.path?.startsWith(`/:`)) {
      url = url.replace(/^ssh:\/\//, ``);
    }
  }

  return url;
}

export function normalizeLocator(locator: Locator) {
  return structUtils.makeLocator(locator, normalizeRepoUrl(locator.reference));
}

export async function lsRemote(repo: string, configuration: Configuration) {
  const normalizedRepoUrl = normalizeRepoUrl(repo, {git: true});

  const networkSettings = httpUtils.getNetworkSettings(`https://${GitUrlParse(normalizedRepoUrl).resource}`, {configuration});
  if (!networkSettings.enableNetwork)
    throw new Error(`Request to '${normalizedRepoUrl}' has been blocked because of your configuration settings`);

  let res: {stdout: string};
  try {
    res = await execUtils.execvp(`git`, [`ls-remote`, normalizedRepoUrl], {
      cwd: configuration.startingCwd,
      env: makeGitEnvironment(),
      strict: true,
    });
  } catch (error) {
    error.message = `Listing the refs for ${repo} failed`;
    throw error;
  }

  const refs = new Map();

  const matcher = /^([a-f0-9]{40})\t([^\n]+)/gm;
  let match;

  while ((match = matcher.exec(res.stdout)) !== null)
    refs.set(match[2], match[1]);

  return refs;
}

export async function resolveUrl(url: string, configuration: Configuration) {
  const {repo, treeish: {protocol, request}, extra} = splitRepoUrl(url);
  const refs = await lsRemote(repo, configuration);

  const resolve = (protocol: TreeishProtocols | string | null, request: string): string => {
    switch (protocol) {
      case TreeishProtocols.Commit: {
        if (!request.match(/^[a-f0-9]{40}$/))
          throw new Error(`Invalid commit hash`);

        return querystring.stringify({
          ...extra,
          commit: request,
        });
      }

      case TreeishProtocols.Head: {
        const head = refs.get(request === `HEAD` ? request : `refs/heads/${request}`);
        if (typeof head === `undefined`)
          throw new Error(`Unknown head ("${request}")`);

        return querystring.stringify({
          ...extra,
          commit: head,
        });
      }

      case TreeishProtocols.Tag: {
        const tag = refs.get(`refs/tags/${request}`);
        if (typeof tag === `undefined`)
          throw new Error(`Unknown tag ("${request}")`);

        return querystring.stringify({
          ...extra,
          commit: tag,
        });
      }

      case TreeishProtocols.Semver: {
        const validRange = semverUtils.validRange(request);
        if (!validRange)
          throw new Error(`Invalid range ("${request}")`);

        const semverTags = new Map([...refs.entries()].filter(([ref]) => {
          return ref.startsWith(`refs/tags/`);
        }).map<[semver.SemVer | null, string]>(([ref, hash]) => {
          return [semver.parse(ref.slice(10)), hash];
        }).filter((entry): entry is [semver.SemVer, string] => {
          return entry[0] !== null;
        }));

        const bestVersion = semver.maxSatisfying([...semverTags.keys()], validRange);
        if (bestVersion === null)
          throw new Error(`No matching range ("${request}")`);

        return querystring.stringify({
          ...extra,
          commit: semverTags.get(bestVersion),
        });
      }

      case null: {
        let result: string | null;

        if ((result = tryResolve(TreeishProtocols.Commit, request)) !== null)
          return result;
        if ((result = tryResolve(TreeishProtocols.Tag, request)) !== null)
          return result;
        if ((result = tryResolve(TreeishProtocols.Head, request)) !== null)
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

  const tryResolve = (protocol: TreeishProtocols | string | null, request: string): string | null => {
    try {
      return resolve(protocol, request);
    } catch (err) {
      return null;
    }
  };

  return `${repo}#${resolve(protocol, request)}`;
}

export async function clone(url: string, configuration: Configuration) {
  return await configuration.getLimit(`cloneConcurrency`)(async () => {
    const {repo, treeish: {protocol, request}} = splitRepoUrl(url);
    if (protocol !== `commit`)
      throw new Error(`Invalid treeish protocol when cloning`);

    const normalizedRepoUrl = normalizeRepoUrl(repo, {git: true});
    if (httpUtils.getNetworkSettings(`https://${GitUrlParse(normalizedRepoUrl).resource}`, {configuration}).enableNetwork === false)
      throw new Error(`Request to '${normalizedRepoUrl}' has been blocked because of your configuration settings`);

    const directory = await xfs.mktempPromise();
    const execOpts = {cwd: directory, env: makeGitEnvironment(), strict: true};

    try {
      await execUtils.execvp(`git`, [`clone`, `-c core.autocrlf=false`, normalizedRepoUrl, npath.fromPortablePath(directory)], execOpts);
      await execUtils.execvp(`git`, [`checkout`, `${request}`], execOpts);
    } catch (error) {
      error.message = `Repository clone failed: ${error.message}`;
      throw error;
    }

    return directory;
  });
}
