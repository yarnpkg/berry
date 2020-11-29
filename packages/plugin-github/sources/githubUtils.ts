import {structUtils, Locator, Descriptor} from '@yarnpkg/core';
import {gitUtils}                         from '@yarnpkg/plugin-git';

import querystring                        from 'querystring';

type ParsedGithubUrl = {
  auth?: string;
  username: string;
  reponame: string;
  treeish: string;
  extra: {
    [key: string]: string,
  },
};

/**
 * Only match http urls that @yarnpkg/plugin-git may handle
 */
const gitPatterns = [
  /^(?:git|(?:git[+:])?https?):\/\/(?:([^/]+?)@)?github\.com\/(?!\.{1,2}\/)([a-zA-Z0-9._-]+)\/(?!\.{1,2}(?:#|$))([a-zA-Z0-9._-]+?)(?:\.git)?(?:#(.*))?$/,
];

/**
 * All patterns
 */
const githubPatterns = [
  /^(?:github:|(?:git|(?:git[+:])?https?):\/\/(?:([^/]+?)@)?github\.com\/)?(?!\.{1,2}\/)([a-zA-Z0-9._-]+)\/(?!\.{1,2}(?:#|$))([a-zA-Z0-9._-]+?)(?:\.git)?(?:#(.*))?$/,
  /^https?:\/\/(?:([^/]+?@))?github.com\/([^/#]+)\/([^/#]+)\/tarball\/([^/#]+)(?:#(.*))?$/,
  ...gitPatterns,
];

export async function addHandledHostedRepository(addHandledHostedRepository: (regExp: RegExp) => void) {
  for (const pattern of gitPatterns) {
    addHandledHostedRepository(pattern);
  }
}

/**
 * Determines whether a given url is a valid github git url via regex
 */
export function isGithubUrl(url: string): boolean {
  return url ? githubPatterns.some(pattern => !!url.match(pattern)) : false;
}

/**
 * Takes a valid github repository url and parses it, returning
 * an object of type `ParsedGithubUrl`
 */
export function parseGithubUrl(urlStr: string): ParsedGithubUrl {
  urlStr = normalizeRepoUrl(urlStr);
  let match;
  for (const pattern of githubPatterns) {
    match = urlStr.match(pattern);
    if (match) {
      break;
    }
  }

  if (!match)
    throw new Error(invalidGithubUrlMessage(urlStr));

  let [, auth, username, reponame, treeish = `master`] = match;

  const {commit, ...extra} = querystring.parse(treeish) as {commit?: string, [key: string]: string | undefined};

  treeish =
    // New style:
    // The URLs have already been normalized by `gitUtils.resolveUrl`,
    // so it's certain in the context of the `GithubFetcher`
    // that the `commit` querystring parameter exists
    commit
    // Old style:
    // Shouldn't ever be needed by the GithubFetcher
    || treeish.replace(/[^:]*:/, ``);

  return {auth, username, reponame, treeish, extra: (extra as {[key: string]: string})};
}

export function normalizeRepoUrl(url: string) {
  url = gitUtils.normalizeRepoUrl(url);

  // We support this as an alias to GitHub repositories
  url = url.replace(/^(?:github:|(?:git[+:])?https:\/\/(?:([^/]+?@))?github\.com\/)?(?!\.{1,2}\/)([a-zA-Z0-9._-]+)\/(?!\.{1,2}(?:#|$))([a-zA-Z0-9._-]+?)(?:\.git)?(#.*)?$/, `https://$1github.com/$2/$3.git$4`);

  // We support GitHub `/tarball/` URLs
  url = url.replace(/^https:\/\/(?:([^/]+?)@)?github\.com\/(?!\.{1,2}\/)([a-zA-Z0-9._-]+)\/(?!\.{1,2}(?:#|$))([a-zA-Z0-9._-]+?)\/tarball\/(.+)?$/, `https://$1github.com/$2/$3.git#$4`);

  return url;
}

export function getUrl({auth, username, reponame, treeish, extra}: ParsedGithubUrl) {
  return `https://${auth ? `${auth}@` : ``}github.com/${username}/${reponame}/archive/${treeish}.tar.gz#source=true${extra.workspace ? `&workspace=${extra.workspace}`: ``}`;
}

export function getDescriptorUrl(locator: Descriptor) {
  return getUrl(parseGithubUrl(locator.range));
}

export function getLocatorUrl(locator: Locator) {
  return getUrl(parseGithubUrl(locator.reference));
}

export function makeDescriptor(descriptor: Descriptor) {
  return structUtils.makeDescriptor(descriptor, getDescriptorUrl(descriptor));
}

export function makeLocator(locator: Locator) {
  return structUtils.makeLocator(locator, getLocatorUrl(locator));
}

export function invalidGithubUrlMessage(url: string): string {
  return `Input cannot be parsed as a valid GitHub URL ('${url}').`;
}
