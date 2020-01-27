import * as gitUtils from './gitUtils';

const VALID_PATTERNS = [
  `GitHubOrg/foo-bar.js`,
  `GitHubOrg/foo-bar.js#hash`,
  `github:GitHubOrg/foo-bar.js`,
  `github:GitHubOrg/foo-bar.js#hash`,
  `https://github.com/TooTallNate/util-deprecate.git#v1.0.0`,
  `https://github.com/TooTallNate/util-deprecate.git#master`,
  `https://github.com/TooTallNate/util-deprecate.git#b3562c2798507869edb767da869cd7b85487726d`,
  `git://github.com/TooTallNate/util-deprecate.git#v1.0.1`,
  `git+ssh://git@github.com/TooTallNate/util-deprecate.git#v1.0.1`,
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
});
