import {tryParseGitURL} from '../hosted-git-info-parse';

export function normalizeRepoUrl(url: string, {git = false}: {git?: boolean} = {}) {
  // "git+https://" isn't an actual Git protocol. It's just a way to
  // disambiguate that this URL points to a Git repository.
  url = url.replace(/^git\+https:/, `https:`);

  // We support this as an alias to GitHub repositories
  url = url.replace(/^(?:github:|https:\/\/github\.com\/|git:\/\/github\.com\/)?(?!\.{1,2}\/)([a-zA-Z0-9._-]+)\/(?!\.{1,2}(?:#|$))([a-zA-Z0-9._-]+?)(?:\.git)?(#.*)?$/, `https://github.com/$1/$2.git$3`);

  // We support GitHub `/tarball/` URLs
  url = url.replace(/^https:\/\/github\.com\/(?!\.{1,2}\/)([a-zA-Z0-9._-]+)\/(?!\.{1,2}(?:#|$))([a-zA-Z0-9._-]+?)\/tarball\/(.+)?$/, `https://github.com/$1/$2.git#$3`);

  if (git) {
    // Try to normalize the URL in a way that git accepts.
    const parsedUrl = tryParseGitURL(url);
    if (parsedUrl)
      url = parsedUrl.href;

    // The `git+` prefix doesn't mean anything at all for Git.
    url = url.replace(/^git\+([^:]+):/, `$1:`);
  }

  return url;
}
