import {isGithubUrl, parseGithubUrl, invalidGithubUrlMessage} from '../sources/githubUtils';

const validScenarios = [{
  url: `http://github.com/owner/repo.git`,
  auth: undefined, username: `owner`, reponame: `repo`, treeish: `master`,
}, {
  url: `https://github.com/owner/repo.git`,
  auth: undefined, username: `owner`, reponame: `repo`, treeish: `master`,
}, {
  url: `https://yarnpkg::;*%$:@github.com/owner/repo.git`,
  auth: `yarnpkg::;*%$:`, username: `owner`, reponame: `repo`, treeish: `master`,
}, {
  url: `https://yarnpkg:$fooABC@:@github.com/owner/repo.git`,
  auth: `yarnpkg:$fooABC@:`, username: `owner`, reponame: `repo`, treeish: `master`,
}, {
  url: `https://yarnpkg:password@github.com/owner/repo.git`,
  auth: `yarnpkg:password`, username: `owner`, reponame: `repo`, treeish: `master`,
}, {
  url: `https://github.com/owner/repo.git#commit:abcdef`,
  auth: undefined, username: `owner`, reponame: `repo`, treeish: `abcdef`,
}, {
  url: `https://github.com/owner/repo.git#abcdef`,
  auth: undefined, username: `owner`, reponame: `repo`, treeish: `abcdef`,
}, {
  url: `https://github.com/owner/repo.git#commit=abcdef`,
  auth: undefined, username: `owner`, reponame: `repo`, treeish: `abcdef`,
}, {
  url: `https://github.com/owner/repo.git#commit=abcdef&workspace=foobar`,
  auth: undefined, username: `owner`, reponame: `repo`, treeish: `abcdef`,
}];

const invalidScenarios = [{
  url: `shttp://github.com/owner/repo.git#master`,
}, {
  url: `got://github.com/owner/repo#ff786f9f`,
}, {
  url: `git://github.com/owner/repo`,
}, {
  url: `http://github.com/owner`,
}];

describe(`githubUtils`, () => {
  describe(`isGithubUrl`, () => {
    for (const scenario of validScenarios) {
      it(`should properly detect GitHub urls (${scenario.url})`, () => {
        expect(isGithubUrl(scenario.url)).toBeTruthy();
      });
    }

    for (const scenario of invalidScenarios) {
      it(`should properly reject invalid GitHub urls (${scenario.url})`, () => {
        expect(isGithubUrl(scenario.url)).not.toBeTruthy();
      });
    }
  });

  describe(`parseGithubUrl`, () => {
    for (const scenario of validScenarios) {
      it(`should properly parse GitHub urls (${scenario.url})`, () => {
        const parsed = parseGithubUrl(scenario.url);

        expect(parsed).toMatchObject({
          auth: scenario.auth,
          username: scenario.username,
          reponame: scenario.reponame,
          treeish: scenario.treeish,
        });
      });
    }

    it(`should throw an error when given an invalid URL`, () => {
      const invalidUrl = `http://invalid.com/owner/repo.git`;
      const expected = invalidGithubUrlMessage(invalidUrl);

      expect(() => {
        parseGithubUrl(invalidUrl);
      }).toThrow(expected);
    });
  });
});
