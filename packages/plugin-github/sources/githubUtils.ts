type ParsedGithubUrl = {
  username: string;
  reponame: string;
  branch?: string;
};

const githubPatterns = [
  /^([a-zA-Z0-9]+(?:-+[a-zA-Z0-9]+)*)\/([a-zA-Z0-9]+(?:-+[a-zA-Z0-9]+)*)(?:#(.+))?$/,
  /^github:([^\/#]+)\/([^\/#]+)(?:#(.+))?$/,
  /^(?:git\+ssh:\/\/)?git@github.com:([^\/#]+)\/([^\/#]+)\.git(?:#(.+))?$/,
  /^git:\/\/github\.com\/([^\/#]+)\/([^\/#]+)\.git(?:#(.+))?$/,
  /^git\+https:\/\/github.com\/([^\/#]+)\/([^\/#]+)\.git?(?:#(.+))?$/,
  /^https?:\/\/(?:.+?@)?github.com\/([^\/#]+)\/([^\/#]+)\/tarball\/([^\/#]+)(?:#|$)/,
  /^https?:\/\/(?:.+?@)?github.com\/([^\/#]+)\/([^\/#]+?)(?:\.git)?(?:#(.+))?$/,
];

/**
  Determines whether a given url is a valid github git url via regex
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

  const [, username, reponame, branch] = match;
  return {username, reponame, branch};
}

export function invalidGithubUrlMessage(url: string): string {
  return `Input cannot be parsed as a valid Github URL ('${url}').`;
}
