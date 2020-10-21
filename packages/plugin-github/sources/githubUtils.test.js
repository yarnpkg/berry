import * as githubUtils from './githubUtils';

const VALID_PATTERNS = [
  // plugin-github only
  `GitHubOrg/foo-bar.js`,
  `GitHubOrg/foo2bar.js`,
  `GitHubOrg/foo-bar.js#hash`,
  `GitHubOrg/foo-bar.js#commit:hash`,
  `GitHubOrg/foo-bar.js#commit=hash`,
  `GitHubOrg/foo-bar.js#commit=hash&workspace=foo`,
  `GitHubOrg/foo-bar.js#tag=hello`,
  `GitHubOrg/foo-bar.js#workspace=foo`,
  `github:GitHubOrg/foo-bar.js`,
  `github:GitHubOrg/foo-bar.js#hash`,
  `https://github.com/TooTallNate/util-deprecate/tarball/b3562c2798507869edb767da869cd7b85487726d`,
  // cross with plugin-git
  `https://github.com/TooTallNate/util-deprecate.git#v1.0.0`,
  `https://github.com/TooTallNate/util-deprecate.git#semver:v1.0.0`,
  `https://github.com/TooTallNate/util-deprecate.git#master`,
  `https://github.com/TooTallNate/util-deprecate.git#b3562c2798507869edb767da869cd7b85487726d`,
  `git://github.com/TooTallNate/util-deprecate.git#v1.0.1`,
  `git+https://github.com/TooTallNate/util-deprecate#v1.0.1`,
  `git+https://github.com/TooTallNate/util-deprecate.git#v1.0.1`,
];

describe(`gitUtils`, () => {
  for (const pattern of VALID_PATTERNS) {
    it(`should detect ${pattern} as a valid Git url`, () => {
      expect(githubUtils.isGithubUrl(githubUtils.normalizeRepoUrl(pattern))).toEqual(true);
    });
  }
});
