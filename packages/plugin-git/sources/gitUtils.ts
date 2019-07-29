type GitUrl = {
  protocol: string;
  hostname: string;
  reponame: string;
};

export function parseGitUrl(urlStr: string): GitUrl {
  // TODO: Implement the urlStr parsing logic
  return {
    protocol: `https`,
    hostname: `facebook`,
    reponame: `react`,
  };
}

export function clone(gitUrl: GitUrl) {
  // TODO: Implementation
  // return Promise<FetchResult>
}
