import * as gitUtils from './gitUtils';

const VALID_PATTERNS = [
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
  `https://github.com/TooTallNate/util-deprecate.git#v1.0.0`,
  `https://github.com/TooTallNate/util-deprecate.git#semver:v1.0.0`,
  `https://github.com/TooTallNate/util-deprecate.git#master`,
  `https://github.com/TooTallNate/util-deprecate.git#b3562c2798507869edb767da869cd7b85487726d`,
  `https://github.com/TooTallNate/util-deprecate/tarball/b3562c2798507869edb767da869cd7b85487726d`,
  `git://github.com/TooTallNate/util-deprecate.git#v1.0.1`,
  `git+ssh://git@github.com/TooTallNate/util-deprecate.git#v1.0.1`,
  `ssh://git@github.com/TooTallNate/util-deprecate.git#v1.0.1`,
  `git+https://github.com/TooTallNate/util-deprecate#v1.0.1`,
  `git+https://github.com/TooTallNate/util-deprecate.git#v1.0.1`,
];

const INVALID_PATTERNS = [
  `./.`,
  `../..`,
];

describe(`gitUtils`, () => {
  for (const pattern of VALID_PATTERNS) {
    it(`should detect ${pattern} as a valid Git url`, () => {
      expect(gitUtils.isGitUrl(pattern)).toEqual(true);
    });
  }

  for (const pattern of INVALID_PATTERNS) {
    it(`shouldn't detect ${pattern} as a valid Git url`, () => {
      expect(gitUtils.isGitUrl(pattern)).toEqual(false);
    });
  }

  for (const pattern of VALID_PATTERNS) {
    it(`should properly normalize ${pattern}`, () => {
      expect(gitUtils.normalizeRepoUrl(pattern)).toMatchSnapshot();
    });
  }

  for (const pattern of VALID_PATTERNS) {
    it(`should properly split ${pattern}`, () => {
      expect(gitUtils.splitRepoUrl(pattern)).toMatchSnapshot();
    });
  }
});
