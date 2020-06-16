import {gitUtils}       from '@yarnpkg/plugin-git';

import * as githubUtils from './githubUtils';

const VALID_PATTERNS = [
  `GitHubOrg/foo-bar.js`,
  `GitHubOrg/foo-bar.js#hash`,
  `github:GitHubOrg/foo-bar.js`,
  `github:GitHubOrg/foo-bar.js#hash`,
];

describe(`gitUtils`, () => {
  for (const pattern of VALID_PATTERNS) {
    it(`should detect ${pattern} as a valid Git url`, () => {
      expect(githubUtils.isGithubUrl(gitUtils.normalizeRepoUrl(pattern))).toEqual(true);
    });
  }
});
