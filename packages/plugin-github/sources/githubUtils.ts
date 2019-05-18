
const githubPatterns = [
  /^github:([^\/#]+)\/([^\/#]+)(?:#(.+))?$/,
  /^[git@github.com:|git:\/\/github.com]+([^\/#]+)\/([^\/#]+)\.git(?:#(.+))?$/,
  /^git\+https:\/\/github.com\/([^\/#]+)\/([^\/#]+)\.git?(?:#(.+))?$/,
  /^https:\/\/github.com\/([^\/#]+)\/([^\/#]+)\/tarball\/([^\/#]+)(?:#|$)/,
  /^[http|https]+:\/\/.*github.com\/([^\/#]+)\/([^\/#]+)\.git?(?:#(.+))?$/,
];

/**
  Determines whether a given url is a valid github git url via regex
*/
export function isGithubUrl(url: string): boolean {
  return url ? githubPatterns.some(pattern => !!url.match(pattern)) : false;
}

const getBranch = (parsedBranch: string): string | undefined => {
  return parsedBranch ? parsedBranch : undefined;
}

interface ParsedGithubUrl {
  username: string;
  reponame: string;
  branch?: string;
}

/**
 * Takes a valid github repository url and parses it, returning
 * an object of type `ParsedGithubUrl`
 */
export function parseGithubUrl(urlStr: string): ParsedGithubUrl {
  let match: Array<string> | null = null;

  for (const pattern of githubPatterns) {
    match = urlStr.match(pattern);
    if (match) {
      break;
    }
  }

  if (!match)
    throw new Error(invalidGithubUrlMessage(urlStr));

  const [, username, reponame, branch] = match;
  return {username, reponame, branch: getBranch(branch)};
}

export function invalidGithubUrlMessage(url: string): string {
  const message = `Input cannot be parsed as a valid Github URL ('${url}').\n
  Consider trying:\n
  https://github.com/username/repo.git\n
  `

  return message;
}
