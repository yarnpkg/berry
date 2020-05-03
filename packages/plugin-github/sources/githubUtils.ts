type ParsedGithubUrl = {
  auth?: string;
  username: string;
  reponame: string;
  treeish: string;
};

const githubPatterns = [
  /^https?:\/\/(?:([^/]+?)@)?github.com\/([^/#]+)\/([^/#]+)\/tarball\/([^/#]+)(?:#(.*))?$/,
  /^https?:\/\/(?:([^/]+?)@)?github.com\/([^/#]+)\/([^/#]+?)(?:\.git)?(?:#(.*))?$/,
];

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

  treeish = treeish.replace(/[^:]*:/, ``);

  return {auth, username, reponame, treeish};
}

export function invalidGithubUrlMessage(url: string): string {
  return `Input cannot be parsed as a valid GitHub URL ('${url}').`;
}
