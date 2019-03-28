const githubPatterns = [
  /^github:([^\/#]+)\/([^\/#]+)(?:#(.+))?$/,
  /^git@github.com:([^\/#]+)\/([^\/#]+)(?:#(.+))?$/,
  /^git\+https:\/\/github.com\/([^\/#]+)\/([^\/#]+)\.git?(?:#(.+))?$/,
  /^https:\/\/github.com\/([^\/#]+)\/([^\/#]+)\/tarball\/([^\/#]+)(?:#|$)/,
];

export function isGithubUrl(string: string) {
  return githubPatterns.some(pattern => !!string.match(pattern));
}

export function parseGithubUrl(string: string) {
  let match;

  for (const pattern of githubPatterns) {
    match = string.match(pattern);
    if (match) {
      break;
    }
  }

  if (!match)
    throw new Error(`Input cannot be parsed as a valid Github URL ('${string}')`);

  const [, username, reponame, branch] = match;
  return {username, reponame, branch: branch ? branch : undefined};
}
