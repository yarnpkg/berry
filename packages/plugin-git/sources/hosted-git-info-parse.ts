// Based on https://github.com/npm/hosted-git-info/blob/cf8115d6fa056fbfb0d63d4d13bde6116b2a02e0/lib/parse-url.js

/**
  @license
  Copyright (c) 2015, Rebecca Turner

  Permission to use, copy, modify, and/or distribute this software for any
  purpose with or without fee is hereby granted, provided that the above
  copyright notice and this permission notice appear in all copies.

  THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
  REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
  FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
  INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
  LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
  OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
  PERFORMANCE OF THIS SOFTWARE.
 */

function lastIndexOfBefore(str: string, char: string, beforeChar: string) {
  const startPosition = str.indexOf(beforeChar);
  return str.lastIndexOf(char, startPosition > -1 ? startPosition : Infinity);
}

function safeURL(url: string) {
  try {
    return new URL(url);
  } catch {
    return undefined;
  }
}

// attempt to correct an scp style url so that it will parse with `new URL()`
function correctURL(gitURL: string) {
  // ignore @ that come after the first hash since the denotes the start
  // of a committish which can contain @ characters
  const firstAt = lastIndexOfBefore(gitURL, `@`, `#`);
  // ignore colons that come after the hash since that could include colons such as:
  // git@github.com:user/package-2#semver:^1.0.0
  const lastColonBeforeHash = lastIndexOfBefore(gitURL, `:`, `#`);

  if (lastColonBeforeHash > firstAt)
    // the last : comes after the first @ (or there is no @)
    // like it would in:
    // proto://hostname.com:user/repo
    // username@hostname.com:user/repo
    // :password@hostname.com:user/repo
    // username:password@hostname.com:user/repo
    // proto://username@hostname.com:user/repo
    // proto://:password@hostname.com:user/repo
    // proto://username:password@hostname.com:user/repo
    // then we replace the last : with a / to create a valid path
    gitURL = `${gitURL.slice(0, lastColonBeforeHash)}/${gitURL.slice(lastColonBeforeHash + 1)}`;

  if (lastIndexOfBefore(gitURL, `:`, `#`) === -1 && gitURL.indexOf(`//`) === -1)
    // we have no : at all
    // as it would be in:
    // username@hostname.com/user/repo
    // then we prepend a protocol
    gitURL = `ssh://${gitURL}`;

  return gitURL;
}

export function tryParseGitURL(gitURL: string) {
  return safeURL(gitURL) || safeURL(correctURL(gitURL));
}
